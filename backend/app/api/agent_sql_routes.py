import base64
import os
import json
import re
import unicodedata
import logging
from typing import Dict, Any, List
from app.services.tenant_resolver import resolve_clean_tenant
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field
import uuid
import asyncio
import time

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.db.database import get_db, SessionLocal
from app.core.config import settings
from app.core.logging_config import get_correlation_id
from app.core.auth import get_current_user

from app.services.dictionary_context_service import (
    build_dictionary_context,
    render_context_for_prompt,
)
from app.services.protheus_context_service import (
    build_protheus_context,
    mask_sensitive_rows,
    validate_query_security,
)
from app.services.protheus_service import ProtheusServiceError, get_tenant_config
from app.services.queryrest_service import queryrest_exec_tenant
from app.services.entitlement_guard import EntitlementDenied, EntitlementGuard
from app.services.protheus_module_catalog import quote_tenant_schema

logger = logging.getLogger("app.api.agent_sql")
router = APIRouter(prefix="/agent", tags=["agent-sql"])

# Gerenciador em memória para polling de tarefas do agente
AGENT_TASKS = {}


async def real_llm_sql_generator(
    prompt: str, 
    context_text: str, 
    empresa: str, 
    filial: str, 
    xfilial: str,
    tenant_id: str,
    environment_code: str,
    image: str = None,
    history: list[dict[str, str]] | None = None,
) -> str:
    """
    Aciona o provedor LLM oficial configurado no backend (Gemini 2.5 Flash ou Ollama)
    para gerar instruções SQL puras adequadas ao banco de dados Oracle do Protheus na TOTVS Cloud,
    respeitando as regras e exclusões lógicas sem inventar estruturas não permitidas.
    """
    system_instruction = f"""Você é o Copilot Protheus SQL Generator, especialista sênior no dicionário de dados do ERP TOTVS Protheus para banco de dados ORACLE em Cloud (SaaS/Hetzner/Cloudflare).
Sua tarefa exclusiva é transformar a pergunta analítica ou de negócio do usuário em UMA ÚNICA consulta SELECT na sintaxe ORACLE perfeitamente formatada para execução via endpoint /QueryRest.

=== CONTEXTO DO DICIONÁRIO DE DADOS AUTORIZADO (RBAC / MÓDULOS CONTRATADOS) ===
Você SÓ pode consultar e referenciar as tabelas e campos listados explicitamente no snapshot abaixo:
{context_text}
=============================================================================

    DIRETRIZES GERAIS E INNEGOCIÁVEIS:
1. Retorne EXCLUSIVAMENTE uma única instrução SELECT ou WITH Oracle. Não envolva a resposta em markdown, comentários ou texto introdutório.
2. Use somente tabelas, nomes físicos e campos presentes no snapshot autorizado. Nunca derive nome físico com sufixo, nunca invente tabela/campo e nunca use `X3_RELACAO` para criar JOIN.
3. Banco ORACLE: nunca use `SELECT TOP` ou `LIMIT`. Toda consulta não agregada deve ter limite Oracle (`ROWNUM <= 500` ou `FETCH FIRST 500 ROWS ONLY`); consultas agregadas devem usar SUM, COUNT, MAX, MIN ou AVG quando o pedido permitir.
4. Use aliases claros e selecione somente os campos necessários. Nunca use `SELECT *`.
5. Toda tabela Protheus do FROM/JOIN deve possuir seu próprio filtro `alias.D_E_L_E_T_ <> '*'`.
6. Respeite as flags SHARING/SX2 de cada tabela. Inclua empresa, unidade e/ou filial somente quando o snapshot indicar que o nível é usado; a filial operacional autorizada é '{xfilial}'. Nunca deduza XFILIAL.
7. Priorize os índices SIX e o `UNIQUE_INDEX` informados para montar JOINs e filtros. Se o relacionamento não estiver sustentado por SIX, X2_UNICO ou convenção Protheus documentada, não invente o JOIN.
8. Padrões documentados: SF2/SD2 usam F2_FILIAL=D2_FILIAL, F2_DOC=D2_DOC e F2_SERIE=D2_SERIE; SF1/SD1 usam filial, documento, série, fornecedor e loja; TES usa D2_TES/F4_CODIGO ou D1_TES/F4_CODIGO quando essas tabelas estiverem autorizadas.
9. Filtros de negócio usuais, como F2_TIPO='N' ou F4_DUPLIC='S', só podem ser usados quando o campo estiver no snapshot e forem pertinentes ao pedido.
10. Nunca acessar campos marcados como sigilosos/mascarados e nunca retornar senha, token, JWT, secret, certificado ou chave.
11. Contexto operacional: empresa='{empresa}', filial='{filial}', XFILIAL='{xfilial}'. Se o snapshot não sustentar a regra necessária, informe a impossibilidade em vez de fabricar SQL.
12. Fidelidade: gere SQL somente com evidências do catálogo autorizado e preserve o escopo tenant, empresa e filial. O environment_code identifica exclusivamente a conexão/API e não deve ser usado para relacionar tabelas, campos ou índices.
13. O snapshot SX3 é a única fonte de campos físicos. Um identificador com aparência Protheus, como F1_TOTAL, não é campo válido se não estiver listado em FIELD para a tabela. Para totais calculados, use SUM/COUNT/AVG somente sobre um campo físico listado e atribua um alias de apresentação explícito com AS; o alias não pode ser usado como campo físico, filtro ou chave de JOIN."""

    domain = _infer_query_domain(prompt)
    domain_instruction = ""
    if domain == "sales":
        domain_instruction = (
            " A intenção é VENDAS/FATURAMENTO. Use SF2/SD2 para notas de saída "
            "e SA1 para clientes quando essas famílias estiverem no catálogo; "
            "nunca use SF1/SD1/SA2, que são entrada/compras/fornecedores."
        )
    elif domain == "purchases":
        domain_instruction = (
            " A intenção é COMPRAS/ENTRADA. Use SF1/SD1 para notas de entrada "
            "e SA2 para fornecedores quando essas famílias estiverem no catálogo; "
            "não trate tabelas de saída como tabelas de entrada."
        )
    user_query = f"Gere a instrução SQL em Oracle para responder: {prompt}.{domain_instruction}"

    backend_mode = (getattr(settings, "llm_backend", "") or os.getenv("LLM_BACKEND", "") or "gemini").lower()
    has_gemini_key = bool(getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY"))
    use_gemini = (backend_mode == "gemini" or (has_gemini_key and not os.getenv("OLLAMA_URL")))

    try:
        if use_gemini:
            from app.services.gemini_client import ask_gemini
            raw_response = await ask_gemini(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={
                    "tenant_system_prompt": system_instruction,
                    "tenant_id": tenant_id,
                    "environment_code": environment_code,
                },
                history=history or [],
                image=image,
                allow_tools=False,
            )
        else:
            from app.services.ollama_client import ask_llm
            raw_response = await ask_llm(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={
                    "tenant_system_prompt": system_instruction,
                    "tenant_id": tenant_id,
                    "environment_code": environment_code,
                },
                history=history or [],
                image=image
            )
    except ProtheusServiceError as e:
        status_code = e.status_code if e.status_code and 400 <= e.status_code <= 599 else 502
        logger.error(
            "[SQL Generator] Falha de integração Protheus status=%s error_type=%s",
            status_code,
            type(e).__name__,
        )
        raise HTTPException(status_code=status_code, detail=str(e)) from e
    except Exception as e:
        logger.error(f"[SQL Generator] Falha ao acionar provedor LLM ({backend_mode}): {e}")
        raise HTTPException(
            status_code=503,
            detail=f"O serviço do provedor de IA ({backend_mode}) está temporariamente indisponível para geração da consulta SQL. Erro: {str(e)}"
        ) from e

    if not raw_response or not isinstance(raw_response, str):
        raise HTTPException(status_code=500, detail="Provedor LLM retornou uma resposta vazia na geração de SQL.")

    if raw_response.startswith("Erro na API do Gemini:") or raw_response.startswith("Erro de conexão com a API do Gemini:") or raw_response.startswith("A inteligência artificial do Google"):
        raise HTTPException(status_code=502, detail=raw_response)

    # Sanitiza blocos de markdown ou comentários ao redor da query
    clean_sql = re.sub(r'```(?:sql)?|```', '', raw_response, flags=re.IGNORECASE).strip()
    
    # Extrai estritamente a partir do SELECT e até o ponto-e-vírgula se aplicável
    sel_idx = clean_sql.upper().find("SELECT")
    if sel_idx != -1:
        clean_sql = clean_sql[sel_idx:].strip()
        if clean_sql.endswith(";"):
            clean_sql = clean_sql[:-1].strip()
    else:
        # Se não há SELECT na resposta, provável alucinação ou erro
        raise HTTPException(status_code=500, detail=f"O provedor LLM falhou ao gerar um SELECT válido. Resposta bruta: {raw_response}")

    return clean_sql


def _is_catalog_field_validation_error(exc: HTTPException) -> bool:
    """Identifica somente falhas de campo físico; demais bloqueios não têm retry."""
    return (
        exc.status_code == 403
        and "campo(s) físico(s)" in str(exc.detail)
        and ("ausente(s)" in str(exc.detail) or "não autorizado(s)" in str(exc.detail))
    )


_DOMAIN_TABLE_FAMILIES = {
    "sales": {"SF2", "SD2", "SA1"},
    "purchases": {"SF1", "SD1", "SA2"},
}


def _infer_query_domain(prompt: str) -> str | None:
    normalized = unicodedata.normalize("NFKD", str(prompt or "").lower())
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9 ]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    sales_terms = (
        "venda", "vendas", "vendido", "faturamento", "faturado", "faturada", "faturadas",
        "pedido de venda", "notas fiscais de saida", "nota de saida", "notas de saida",
    )
    purchase_terms = (
        "compra", "compras", "comprado", "entrada", "entradas", "fornecedor",
        "nota de entrada", "notas de entrada", "recebimento",
    )
    has_sales = any(term in normalized for term in sales_terms)
    has_purchases = any(term in normalized for term in purchase_terms)
    if has_sales and not has_purchases:
        return "sales"
    if has_purchases and not has_sales:
        return "purchases"
    return None


def _table_families_from_context(context: list[dict[str, Any]]) -> set[str]:
    families = set()
    for item in context:
        table = item.get("table") or {}
        for value in (
            table.get("table_code"),
            table.get("table_name"),
            table.get("physical_name"),
        ):
            compact = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
            for family in {"SF1", "SD1", "SA2", "SF2", "SD2", "SA1"}:
                if compact.startswith(family):
                    families.add(family)
    return families


def _table_families_from_sql(sql: str) -> set[str]:
    families = set()
    for match in re.finditer(r"\b(?:FROM|JOIN)\s+([A-Z][A-Z0-9_$#]*)", str(sql or "").upper()):
        compact = re.sub(r"[^A-Z0-9]", "", match.group(1))
        for family in {"SF1", "SD1", "SA2", "SF2", "SD2", "SA1"}:
            if compact.startswith(family):
                families.add(family)
    return families


def _domain_context_block(prompt: str, context: list[dict[str, Any]]) -> str | None:
    domain = _infer_query_domain(prompt)
    if not domain:
        return None
    families = _table_families_from_context(context)
    required = _DOMAIN_TABLE_FAMILIES[domain]
    if families.isdisjoint(required):
        if domain == "sales":
            return (
                "A pergunta é de vendas/faturamento, mas o módulo e o snapshot ativos "
                "não contêm SF2/SD2/SA1. Selecione um módulo de vendas autorizado e "
                "sincronize o dicionário antes de consultar."
            )
        return (
            "A pergunta é de compras/entrada, mas o módulo e o snapshot ativos não "
            "contêm SF1/SD1/SA2. Selecione um módulo de compras autorizado e "
            "sincronize o dicionário antes de consultar."
        )
    return None


def _validate_query_domain(prompt: str, sql: str) -> None:
    domain = _infer_query_domain(prompt)
    if not domain:
        return
    families = _table_families_from_sql(sql)
    if domain == "sales":
        if families.intersection({"SF1", "SD1", "SA2"}):
            raise HTTPException(
                status_code=422,
                detail="Consulta de vendas gerou tabela de entrada/fornecedor (SF1, SD1 ou SA2); SQL bloqueado.",
            )
        if not families.intersection(_DOMAIN_TABLE_FAMILIES["sales"]):
            raise HTTPException(
                status_code=422,
                detail="A consulta de vendas não referencia SF2, SD2 ou SA1 no SQL gerado.",
            )
    elif families.intersection({"SF2", "SD2", "SA1"}):
        raise HTTPException(
            status_code=422,
            detail="Consulta de compras/entrada gerou tabela de saída/cliente; SQL bloqueado.",
        )


def _load_conversation_history(
    db: Session,
    tenant_schema: str,
    tenant_id: str,
    company_id: int,
    conversation_id: str,
    actor_key: str,
    limit: int = 12,
) -> list[dict[str, str]]:
    """Carrega somente turnos textuais do escopo exato da conversa.

    A tabela memories é reutilizada como armazenamento de contexto textual;
    linhas, colunas e respostas do ERP nunca são gravadas aqui.
    """
    schema = quote_tenant_schema(tenant_schema)
    rows = db.execute(
        text(f"""
            SELECT memory_key, memory_value
              FROM {schema}.memories
             WHERE tenant_id = :tenant_id
               AND company_id::text = CAST(:company_id AS text)
               AND memory_type = 'conversation_turn'
               AND scope = :conversation_id
               AND source = :actor_key
             ORDER BY created_at ASC, id ASC
             LIMIT :limit
        """),
        {
            "tenant_id": tenant_id,
            # O schema histórico pode armazenar company_id como INTEGER ou
            # VARCHAR(100). O cast no SQL e o valor textual mantêm o filtro
            # compatível sem cruzar o escopo de tenant/empresa.
            "company_id": str(company_id),
            "conversation_id": conversation_id,
            "actor_key": actor_key,
            "limit": limit,
        },
    ).mappings().all()
    return [
        {"role": str(row["memory_key"]), "content": str(row["memory_value"])}
        for row in rows
        if row.get("memory_key") in {"user", "assistant"} and row.get("memory_value")
    ]


def _append_conversation_turn(
    db: Session,
    tenant_schema: str,
    tenant_id: str,
    company_id: int,
    conversation_id: str,
    actor_key: str,
    role: str,
    content: str,
) -> None:
    """Persiste somente texto resumido da conversa, nunca o resultado do ERP."""
    if role not in {"user", "assistant"} or not str(content or "").strip():
        return
    schema = quote_tenant_schema(tenant_schema)
    db.execute(
        text(f"""
            INSERT INTO {schema}.memories
                (tenant_id, company_id, visibility, memory_key, memory_value,
                 memory_type, scope, source)
            VALUES
                (:tenant_id, :company_id, 'private', :role, :content,
                 'conversation_turn', :conversation_id, :actor_key)
        """),
        {
            # String numérica é aceita tanto por instalações com company_id
            # INTEGER quanto por schemas legados com company_id textual.
            "tenant_id": tenant_id,
            "company_id": str(company_id),
            "role": role,
            "content": str(content).strip()[:4000],
            "conversation_id": conversation_id,
            "actor_key": actor_key,
        },
    )


def _normalize_conversation_history(value: Any, limit: int = 12) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value[-limit:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = item.get("content", item.get("text"))
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        content = content.strip()
        if content:
            normalized.append({"role": role, "text": content[:4000]})
    return normalized


def _build_catalog_revision_prompt(prompt: str, rejected_sql: str, reason: str) -> str:
    """Instrui uma única revisão baseada no snapshot, sem sugerir campo substituto."""
    return (
        f"{prompt}\n\n"
        "REVISÃO OBRIGATÓRIA: a primeira consulta foi rejeitada porque contém "
        "identificador físico ausente ou não autorizado no catálogo SX3 do tenant. "
        "Gere novamente a consulta do zero usando exclusivamente os FIELD listados "
        "no snapshot. Não invente um campo substituto. Se precisar de total, aplique "
        "SUM/COUNT/AVG sobre um campo físico listado e use alias explícito com AS. "
        "Não reutilize aliases em WHERE ou JOIN.\n"
        f"Motivo da rejeição: {reason}\n"
        f"SQL rejeitado: {rejected_sql}"
    )


async def process_agent_task(task_id: str, payload: dict):
    started = time.time()
    task_state = AGENT_TASKS.get(task_id) or {}
    correlation_id = task_state.get("correlation_id") or get_correlation_id()
    task_state["correlation_id"] = correlation_id
    AGENT_TASKS[task_id] = task_state
    logger.info("agent_task_started task_id=%s", task_id)
    try:

        execute = payload.get("execute", False)
        
        prompt = payload.get("prompt") or payload.get("query")
        if not prompt:
            AGENT_TASKS[task_id] = {"status": "error", "error": "O campo prompt ou query é obrigatório na v2.", "correlation_id": correlation_id}

            return

        environment_code = str(
            payload.get("environment_code")
            or (payload.get("context") or {}).get("environment_code")
            or ""
        ).strip()
        if not environment_code or environment_code.lower() in {"default", "none", "null"}:
            AGENT_TASKS[task_id] = {
                "status": "error",
                "error": "environment_code real é obrigatório para execução no Protheus.",
                "correlation_id": correlation_id,
            }
            return

        file_data = payload.get("file")

        image_b64 = file_data.get("data") if isinstance(file_data, dict) else None

        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        from app.db.database import resolve_clean_tenant
        from app.services.protheus_context_resolver import resolve_context
        from app.services.protheus_module_catalog import (
            filter_allowed_dictionary_tables,
            load_dictionary_fields,
            load_dictionary_indexes,
        )
        
        with SessionLocal() as db:
            try:
                # 1. Resolve o contexto de forma segura (Tenant, Schema, Módulo, Branch)
                ctx = resolve_context(db, payload)
            except ValueError as ve:
                AGENT_TASKS[task_id] = {"status": "error", "error": str(ve), "correlation_id": correlation_id}

                return

            clean_tenant = ctx.schema_name
            logger.info(
                "agent_context_resolved task_id=%s tenant=%s environment=%s company_id=%s module=%s",
                task_id,
                ctx.tenant_id,
                environment_code,
                ctx.company_id,
                ctx.module_code,
            )
            if clean_tenant and clean_tenant != "public":

                ensure_tenant_tables(db, clean_tenant)
                db.execute(text(f'SET search_path TO {clean_tenant}, public'))
                db.commit()

            # 2. Entitlements: licença, usuário, módulo, consumo e conexões.
            context_payload = payload.get("context") or {}
            session_key = payload.get("session_key") or context_payload.get("session_key") or correlation_id
            conversation_id = str(
                payload.get("conversation_id")
                or payload.get("session_id")
                or context_payload.get("conversation_id")
                or context_payload.get("session_id")
                or session_key
            ).strip()
            user_identity = (
                payload.get("user_id")
                or context_payload.get("user_id")
                or context_payload.get("user")
                or context_payload.get("usuario")
            )
            role_id = payload.get("role_id") or context_payload.get("role_id") or context_payload.get("profile") or context_payload.get("perfil")
            actor_key = str(user_identity or context_payload.get("user") or context_payload.get("usuario") or "anonymous").strip()[:255]
            persisted_history = _load_conversation_history(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
            )
            conversation_history = _normalize_conversation_history(
                persisted_history + _normalize_conversation_history(payload.get("history"))
            )
            _append_conversation_turn(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
                role="user",
                content=str(prompt),
            )
            db.commit()
            entitlement_guard = EntitlementGuard()
            try:
                entitlement = entitlement_guard.authorize(
                    db,
                    tenant_code=ctx.tenant_id,
                    environment_code=environment_code,
                    module_code=ctx.module_code,
                    user_identity=str(user_identity) if user_identity else None,
                    role_id=str(role_id) if role_id else None,
                    correlation_id=correlation_id,
                )
            except EntitlementDenied as exc:
                AGENT_TASKS[task_id] = {
                    "status": "error",
                    "error": exc.message,
                    "error_code": exc.code,
                    "correlation_id": correlation_id,
                }
                return

            if not entitlement.allowed:
                logger.warning(
                    "entitlement_shadow_issues task_id=%s codes=%s",
                    task_id,
                    ",".join(issue["code"] for issue in entitlement.issues),
                )

            # 3. Montar contexto XFILIAL
            # O build_protheus_context legada continua operando para gerar a string xfilial
            op_context = build_protheus_context(empresa=ctx.company_code or "", filial=ctx.branch)
            # Para evitar erro nas variáveis, injetamos empresa
            op_context["empresa"] = ctx.company_code or ""
            op_context["filial"] = ctx.branch

            # 4. Carregar dicionário SEGURO (usando o filter novo)
            tables = filter_allowed_dictionary_tables(
                db=db,
                tenant_schema=ctx.schema_name,
                module_codes=[ctx.module_code],
                company_id=ctx.company_id,
            )

            # O LLM recebe campos e índices por leitores compatíveis com snapshots legados.
            context = []
            for t in tables:
                table_data = dict(t)
                fields = load_dictionary_fields(
                    db=db,
                    tenant_schema=ctx.schema_name,
                    table_code=table_data.get("table_code"),
                    table_name=table_data.get("table_name"),
                )
                indexes = load_dictionary_indexes(
                    db=db,
                    tenant_schema=ctx.schema_name,
                    table_code=table_data.get("table_code"),
                    table_name=table_data.get("table_name"),
                )

                context.append({
                    "table": table_data,
                    "fields": fields,
                    "indexes": indexes,
                })

            if not context:
                AGENT_TASKS[task_id] = {"status": "error", "error": "Nenhuma tabela liberada ou encontrada no snapshot do dicionário para os filtros informados.", "correlation_id": correlation_id}

                return

            permission_table_names = {
                str(name).strip()
                for item in context
                for name in (
                    item["table"].get("table_name"),
                    item["table"].get("physical_name"),
                    item["table"].get("table_alias"),
                )
                if name
            }
            catalog_fields_by_table = {}
            for item in context:
                table = item.get("table") or {}
                field_names = {
                    str(field.get("field_name") or "").strip().upper()
                    for field in item.get("fields", [])
                    if field.get("field_name")
                }
                for table_name in (
                    table.get("table_name"),
                    table.get("physical_name"),
                ):
                    if table_name and field_names:
                        catalog_fields_by_table.setdefault(str(table_name), set()).update(field_names)

            dictionary_authorization = entitlement_guard.authorize_dictionary_details(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_code=ctx.tenant_id,
                environment_code=environment_code,
                company_id=ctx.company_id,
                role_id=entitlement.role_id,
                table_names=permission_table_names,
                catalog_fields_by_table=catalog_fields_by_table,
            )
            allowed_permission_tables = dictionary_authorization.allowed_tables
            allowed_fields_by_table = dictionary_authorization.allowed_fields_by_table
            allowed_filter_fields_by_table = dictionary_authorization.filter_fields_by_table
            masked_fields = {
                field_name
                for field_names in dictionary_authorization.masked_fields_by_table.values()
                for field_name in field_names
            }
            if entitlement_guard.mode == "enforce":
                if not allowed_permission_tables:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "Nenhuma permissão de tabela autoriza consultas para o perfil informado.",
                        "error_code": "TABLE_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return
                if not allowed_fields_by_table:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "Nenhuma permissão de campo autoriza retorno para o perfil informado.",
                        "error_code": "FIELD_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return

                permission_tokens = {str(value).strip().upper() for value in allowed_permission_tables}
                filtered_context = []
                for item in context:
                    table = item["table"]
                    table_tokens = {
                        str(name).strip().upper()
                        for name in (
                            table.get("table_name"),
                            table.get("physical_name"),
                        )
                        if name
                    }
                    matched_tokens = table_tokens & permission_tokens
                    if not matched_tokens:
                        continue
                    permitted_fields = {
                        str(field_name).strip().upper()
                        for token in matched_tokens
                        for field_name in allowed_fields_by_table.get(token, set())
                    }
                    visible_fields = [
                        field for field in item.get("fields", [])
                        if str(field.get("field_name") or "").strip().upper() in permitted_fields
                    ]
                    if not visible_fields:
                        continue
                    filtered_context.append({**item, "fields": visible_fields})

                context = filtered_context
                if not context:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "As permissões do perfil não autorizam campos selecionáveis nas tabelas do snapshot.",
                        "error_code": "FIELD_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return

            domain_block = _domain_context_block(str(prompt), context)
            if domain_block:
                AGENT_TASKS[task_id] = {
                    "status": "error",
                    "error": domain_block,
                    "error_code": "DOMAIN_CATALOG_MISMATCH",
                    "conversation_id": conversation_id,
                    "correlation_id": correlation_id,
                }
                return

            context_text = render_context_for_prompt(context)
            allowed_table_names = {
                str(name).strip()
                for item in context
                for name in (
                    item["table"].get("table_name"),
                    item["table"].get("physical_name"),
                    item["table"].get("table_alias"),
                )
                if name
            }
            allowed_field_names = {
                str(field.get("field_name")).upper()
                for item in context
                for field in item.get("fields", [])
                if field.get("field_name")
            }

            # 4. LLM
            sql = await real_llm_sql_generator(
                prompt=str(prompt),
                context_text=context_text,
                empresa=op_context["empresa"],
                filial=op_context["filial"],
                xfilial=op_context["xfilial"],
                tenant_id=str(ctx.tenant_id),
                environment_code=environment_code,
                image=image_b64,
                history=conversation_history,

            )
            _validate_query_domain(str(prompt), sql)

            # 5. Segurança. Um campo ausente do SX3 nunca é liberado. Quando a
            # primeira geração inventar um identificador, o LLM recebe uma única
            # oportunidade de reconstruir o SQL usando o mesmo snapshot autorizado.
            validation_args = {
                "allowed_tables": allowed_table_names,
                "allowed_fields": allowed_field_names,
                "allowed_fields_by_table": allowed_fields_by_table if entitlement_guard.mode == "enforce" else None,
                "filter_fields_by_table": allowed_filter_fields_by_table if entitlement_guard.mode == "enforce" else None,
                "filial": op_context["xfilial"],
            }
            try:
                validate_query_security(sql=sql, **validation_args)
            except HTTPException as exc:
                if not _is_catalog_field_validation_error(exc):
                    raise
                logger.warning(
                    "agent_sql_catalog_retry task_id=%s reason=physical_field_not_in_catalog",
                    task_id,
                )
                sql = await real_llm_sql_generator(
                    prompt=_build_catalog_revision_prompt(str(prompt), sql, str(exc.detail)),
                    context_text=context_text,
                    empresa=op_context["empresa"],
                    filial=op_context["filial"],
                    xfilial=op_context["xfilial"],
                    tenant_id=str(ctx.tenant_id),
                    environment_code=environment_code,
                    image=image_b64,
                    history=conversation_history,
                )
                _validate_query_domain(str(prompt), sql)
                validate_query_security(sql=sql, **validation_args)

            context_tables = [
                {
                    "table_code": item["table"].get("table_code"),
                    "table_name": item["table"].get("table_name"),
                    "physical_name": item["table"].get("physical_name") or item["table"].get("table_alias"),
                    "description": item["table"].get("description"),
                    "module_code": item["table"].get("module_code"),
                }
                for item in context
            ]
            response = {
                "status": "success",
                                    "correlation_id": correlation_id,
                    "conversation_id": conversation_id,
                    "tenant_id": str(ctx.tenant_id),

                "environment_code": environment_code,
                "company_id": ctx.company_id,
                "context_operational": op_context,
                "tables_in_context": len(context),
                "tables_used": context_tables,
                "sql": sql,
                "entitlement": entitlement.as_dict(),
                "response_time_ms": int((time.time() - started) * 1000),
            }

            # 6. QueryRest
            if execute:
                try:
                    entitlement_guard.reserve(
                        db,
                        entitlement,
                        session_key=str(session_key),
                        correlation_id=correlation_id,
                    )
                except EntitlementDenied as exc:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": exc.message,
                        "error_code": exc.code,
                        "correlation_id": correlation_id,
                    }
                    return

                logger.info(
                    "agent_queryrest_start task_id=%s tenant=%s environment=%s",
                    task_id,
                    ctx.tenant_id,
                    environment_code,
                )
                try:
                    rows = await queryrest_exec_tenant(

                        db=db,
                        tenant_id=str(ctx.tenant_id),
                        company_id=ctx.company_id,
                        query=sql,
                        environment_code=environment_code,


                    )
                    safe_rows = mask_sensitive_rows(
                        rows,
                        masked_fields=masked_fields if entitlement_guard.mode == "enforce" else None,
                    )
                    response["records"] = len(rows)
                    response["data"] = safe_rows[:500]
                    response["structured"] = {
                        "columns": list(safe_rows[0].keys()) if safe_rows and isinstance(safe_rows[0], dict) else [],
                        "rows": safe_rows[:500],
                        "total_records": len(rows),
                        "display_limit": 500,
                    }
                    logger.info("agent_queryrest_success task_id=%s records=%s", task_id, len(rows))

                    if len(rows) == 0:
                        response["summary"] = "A consulta ao banco Oracle do Protheus foi executada com sucesso, porém retornou zero registros (tabela vazia ou sem correspondências no período)."
                    elif safe_rows and isinstance(safe_rows[0], dict):
                        response["summary"] = (
                            f"A consulta ao Protheus retornou {len(rows)} registros. "
                            "Os dados estruturados estão disponíveis na tabela e nas visualizações do relatório."
                        )
                    else:
                        response["summary"] = f"A consulta retornou {len(rows)} registros, mas o formato recebido não é tabular."
                except HTTPException as http_ex:
                    response["status"] = "execution_failed"
                    response["execution_error"] = http_ex.detail
                    logger.warning("agent_queryrest_failed task_id=%s status=%s", task_id, http_ex.status_code)
                finally:
                    if entitlement.lease_key:
                        entitlement_guard.release_session(db, ctx.tenant_id, entitlement.lease_key)

            AGENT_TASKS[task_id] = response
            if response.get("status") == "success":
                assistant_memory = "A consulta anterior foi processada pelo Protheus."
            elif response.get("status") == "execution_failed":
                assistant_memory = "A consulta anterior não foi executada porque o QueryRest retornou falha."
            else:
                assistant_memory = "A consulta anterior foi bloqueada pelas regras de segurança."
            _append_conversation_turn(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
                role="assistant",
                content=assistant_memory,
            )
            db.commit()
            logger.info("agent_task_completed task_id=%s status=%s elapsed_ms=%s", task_id, response.get("status"), response.get("response_time_ms"))

    except HTTPException as e:
        AGENT_TASKS[task_id] = {"status": "error", "error": e.detail, "correlation_id": correlation_id}
        logger.warning("agent_task_failed task_id=%s status=%s", task_id, e.status_code)
    except ProgrammingError as e:
        db_error = str(e).splitlines()[0][:240]
        logger.error("agent_task_failed task_id=%s error_type=ProgrammingError db_error=%s", task_id, db_error)
        AGENT_TASKS[task_id] = {
            "status": "error",
            "error": "O catálogo ou o schema do banco está incompatível com a versão do backend.",
            "error_code": "DATABASE_SCHEMA_MISMATCH",
            "correlation_id": correlation_id,
        }
    except Exception as e:
        logger.error("agent_task_failed task_id=%s error_type=%s", task_id, type(e).__name__)
        AGENT_TASKS[task_id] = {"status": "error", "error": "Falha interna ao processar a tarefa.", "correlation_id": correlation_id}

class QueryRestProxyRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=100)
    environment_code: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=100000)
    company_id: int | str | None = None
    context: Dict[str, Any] = Field(default_factory=dict)


@router.post("/queryrest")
async def queryrest_proxy(
    payload: QueryRestProxyRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Executa uma consulta somente leitura recebida do gateway autenticado."""
    token_tenant = str(
        current_user.get("tenant_id")
        or current_user.get("tenantId")
        or ""
    ).strip()
    if not token_tenant:
        raise HTTPException(
            status_code=401,
            detail="JWT sem tenant_id; consulta QueryRest bloqueada.",
        )
    if token_tenant != "public" and token_tenant.lower() != payload.tenant_id.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="O tenant do JWT não corresponde ao tenant da consulta.",
        )

    context_payload = {
        **payload.context,
        "tenant_id": payload.tenant_id,
        "environment_code": payload.environment_code,
    }
    if payload.company_id is not None:
        context_payload["company_id"] = payload.company_id

    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    from app.services.protheus_context_resolver import resolve_context
    from app.services.protheus_module_catalog import filter_allowed_dictionary_tables

    with SessionLocal() as db:
        try:
            ctx = resolve_context(
                db,
                {
                    "tenant_id": payload.tenant_id,
                    "environment_code": payload.environment_code,
                    "company_id": payload.company_id,
                    "context": context_payload,
                },
            )
            ensure_tenant_tables(db, ctx.schema_name)
            db.execute(text(f'SET search_path TO "{ctx.schema_name}", public'))
            db.commit()

            tables = filter_allowed_dictionary_tables(
                db=db,
                tenant_schema=ctx.schema_name,
                module_codes=[ctx.module_code],
                company_id=ctx.company_id,
            )
            allowed_table_names = {
                name
                for table in tables
                for name in (table.get("table_name"), table.get("physical_name"))
                if name
            }
            if not allowed_table_names:
                raise HTTPException(
                    status_code=403,
                    detail="Nenhuma tabela está autorizada para o contexto informado.",
                )

            validate_query_security(
                sql=payload.query,
                allowed_tables=allowed_table_names,
                filial=ctx.branch,
            )
            rows = await queryrest_exec_tenant(
                db=db,
                tenant_id=ctx.tenant_id,
                company_id=ctx.company_id,
                query=payload.query,
                environment_code=payload.environment_code,
            )
            return {
                "status": "success",
                "tenant_id": ctx.tenant_id,
                "environment_code": payload.environment_code,
                "records": len(rows),
                "items": rows[:500],
            }
        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.error(
                "queryrest_proxy_failed tenant=%s environment=%s error_type=%s",
                payload.tenant_id,
                payload.environment_code,
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=502,
                detail="Falha na execução do QueryRest do Protheus.",
            ) from exc


@router.post("/ask/v2")
async def ask_v2(payload: dict) -> Dict[str, Any]:
    # Checagem rapida de tenant antes de disparar task
    tenant_id = payload.get("tenant_id")
    environment_code = str(
        payload.get("environment_code")
        or (payload.get("context") or {}).get("environment_code")
        or ""
    ).strip()
    if not tenant_id or tenant_id == "default" or environment_code.lower() in {"", "default", "none", "null"}:
        return {"summary": "Desculpe, mas eu preciso estar aberto dentro do ERP Protheus (com um contexto válido) para executar consultas no banco de dados."}

    task_id = str(uuid.uuid4())
    correlation_id = get_correlation_id()
    AGENT_TASKS[task_id] = {"status": "processing", "correlation_id": correlation_id}
    logger.info("agent_task_accepted task_id=%s", task_id)
    asyncio.create_task(process_agent_task(task_id, payload))
    return {"status": "processing", "task_id": task_id, "correlation_id": correlation_id}

@router.post("/ask/v2/upload")
async def ask_v2_upload(
    tenant_id: str = Form(...),
    environment_code: str = Form(...),
    company_id: str | None = Form(None),
    query: str = Form(...),
    context: str = Form("{}"),
    file: UploadFile = File(...),
):
    """Enfileira análise de arquivo usando o mesmo fluxo agent-sql OAuth2."""

    clean_tenant = str(tenant_id or "").strip()
    clean_environment = str(environment_code or "").strip()
    if not clean_tenant or clean_tenant.lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="tenant_id real é obrigatório.")
    if not clean_environment or clean_environment.lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="environment_code real é obrigatório.")
    if not query.strip():
        raise HTTPException(status_code=400, detail="O campo query é obrigatório.")

    try:
        parsed_context = json.loads(context or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="context deve ser um objeto JSON válido.") from exc
    if not isinstance(parsed_context, dict):
        raise HTTPException(status_code=400, detail="context deve ser um objeto JSON.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Arquivo excede o limite permitido.")

    payload = {
        "query": query,
        "tenant_id": clean_tenant,
        "environment_code": clean_environment,
        "company_id": company_id,
        "execute": True,
        "context": {
            **parsed_context,
            "tenant_id": clean_tenant,
            "environment_code": clean_environment,
        },
        "file": {
            "name": file.filename or "upload",
            "content_type": file.content_type or "application/octet-stream",
            "data": base64.b64encode(content).decode("ascii"),
        },
    }

    task_id = str(uuid.uuid4())
    correlation_id = get_correlation_id()
    AGENT_TASKS[task_id] = {"status": "processing", "correlation_id": correlation_id}
    logger.info("agent_task_accepted task_id=%s", task_id)
    asyncio.create_task(process_agent_task(task_id, payload))
    return {"status": "processing", "task_id": task_id, "correlation_id": correlation_id}


@router.get("/ask/v2/status/{task_id}")
async def ask_v2_status(task_id: str):

    if task_id not in AGENT_TASKS:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    
    # Mantém os campos error/error_code e também summary por compatibilidade com clientes antigos.
    if AGENT_TASKS[task_id].get("status") == "error":
        task = AGENT_TASKS[task_id]
        return {
            "status": "error",
            "error": task.get("error") or task.get("summary"),
            "error_code": task.get("error_code"),
            "summary": task.get("error") or task.get("summary"),
            "conversation_id": task.get("conversation_id"),
            "correlation_id": task.get("correlation_id"),
        }

    return AGENT_TASKS[task_id]


from fastapi.responses import StreamingResponse
from app.core.log_streamer import stream_manager

@router.get("/stream-logs")
async def stream_logs():
    """
    Endpoint SSE (Server-Sent Events) para transmissão do log do backend em tempo real
    para o chat do Copilot (quando comando /log é acionado).
    """
    return StreamingResponse(
        stream_manager.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
