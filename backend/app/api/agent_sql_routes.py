import time
import re
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.config import settings
from app.services.dictionary_context_service import (
    build_dictionary_context,
    render_context_for_prompt,
)
from app.services.protheus_context_service import build_protheus_context, validate_query_security
from app.services.queryrest_service import queryrest_exec_tenant

logger = logging.getLogger("app.api.agent_sql")
router = APIRouter(prefix="/agent", tags=["agent-sql"])


async def real_llm_sql_generator(
    prompt: str, 
    context_text: str, 
    empresa: str, 
    filial: str, 
    xfilial: str, 
    tenant_id: str = "default"
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
1. Retorne EXCLUSIVAMENTE o código SQL da consulta (começando obrigatoriamente por SELECT). NÃO envolva a resposta em blocos de markdown (```sql ou ```) nem acrescente qualquer comentário ou texto introdutório.
2. Banco de Dados ORACLE: NUNCA utilize a sintaxe `SELECT TOP N`. Em consultas paginadas ou limitadas, você é obrigado a usar a sintaxe Oracle:
   - Para limite de linhas simples: `WHERE ROWNUM <= N` (inserido apropriadamente) ou no formato subquery.
   - Para paginação/limitação padrão ANSI/Oracle: `OFFSET 0 ROWS FETCH NEXT N ROWS ONLY`.
3. Filtro Obrigatório de Exclusão Lógica: Toda e qualquer tabela do Protheus referenciada no FROM ou JOINs precisa estar filtrada pela cláusula de exclusão lógica: `D_E_L_E_T_ <> '*'`.
4. Injeção de Empresa e Filial (XFILIAL): A empresa operacional atual é '{empresa}' e a filial (XFILIAL) ativa é '{xfilial}'. É OBRIGATÓrio incluir a restrição pela filial aplicável para as tabelas (ex: `A1_FILIAL = '{xfilial}'`, `F2_FILIAL = '{xfilial}'`, `E1_FILIAL = '{xfilial}'`).
5. Cruzamentos e JOINs no Protheus:
   - Faturamento (Notas de Saída): cruzamento entre SF2 (cabeçalho) e SD2 (itens) via `F2_FILIAL = D2_FILIAL AND F2_DOC = D2_DOC AND F2_SERIE = D2_SERIE`.
   - Saídas Financeiras (TES): JOIN com SF4 via `D2_TES = F4_CODIGO`.
   - Notas Normais: `F2_TIPO = 'N'` (desconsidera devoluções e complementos).
   - Notas de Entrada: cruzamento entre SF1 e SD1 via `F1_FILIAL = D1_FILIAL AND F1_DOC = D1_DOC AND F1_SERIE = D1_SERIE AND F1_FORNECE = D1_FORNECE AND F1_LOJA = D1_LOJA`.
6. Fidelidade aos Dados: NUNCA invente nomes de tabelas ou colunas que não existam na árvore autorizada acima."""

    user_query = f"Gere a instrução SQL em Oracle para responder: {prompt}"

    try:
        if settings.llm_backend == "gemini":
            from app.services.gemini_client import ask_gemini
            raw_response = await ask_gemini(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={"tenant_system_prompt": system_instruction, "tenant_id": tenant_id},
                history=[]
            )
        else:
            from app.services.ollama_client import ask_llm
            raw_response = await ask_llm(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={"tenant_system_prompt": system_instruction, "tenant_id": tenant_id},
                history=[]
            )
    except Exception as e:
        logger.error(f"[SQL Generator] Falha ao acionar provedor LLM ({settings.llm_backend}): {e}")
        raise HTTPException(
            status_code=503, 
            detail=f"O serviço do provedor de IA ({settings.llm_backend}) está temporariamente indisponível para geração da consulta SQL. Erro: {str(e)}"
        )

    if not raw_response or not isinstance(raw_response, str):
        raise HTTPException(status_code=500, detail="Provedor LLM retornou uma resposta vazia na geração de SQL.")

    # Sanitiza blocos de markdown ou comentários ao redor da query
    clean_sql = re.sub(r'```(?:sql)?|```', '', raw_response, flags=re.IGNORECASE).strip()
    
    # Extrai estritamente a partir do SELECT e até o ponto-e-vírgula se aplicável
    sel_idx = clean_sql.upper().find("SELECT")
    if sel_idx != -1:
        clean_sql = clean_sql[sel_idx:].strip()
        if clean_sql.endswith(";"):
            clean_sql = clean_sql[:-1].strip()

    return clean_sql


@router.post("/ask/v2")
async def ask_v2(payload: dict, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Endpoint v2 do agente de análise de dados no Protheus com escopo granular:
    - Injeta contexto de empresa e filial (XFILIAL).
    - Lê o último snapshot válido do dicionário para a empresa/tenant.
    - Aciona o LLM para geração de SQL Oracle otimizado.
    - Valida permissões e restrições de segurança (sem alucinações nem acessos não autorizados).
    - Executa a consulta via /QueryRest prioritariamente se solicitado.
    """
    started = time.time()

    tenant_id = payload.get("tenant_id")
    company_id = payload.get("company_id")
    prompt = payload.get("prompt")
    empresa = payload.get("empresa")
    filial = payload.get("filial")
    module_filter = payload.get("module_filter")
    execute = payload.get("execute", False)

    if not tenant_id or company_id is None or not prompt:
        raise HTTPException(status_code=400, detail="Os campos tenant_id, company_id e prompt são obrigatórios na v2.")

    import re
    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()

    # 0. Valida cota e limite diário do tenant (HTTP 429 se excedido)
    from app.core.rate_limit import check_tenant_rate_limit
    rate_info = check_tenant_rate_limit(db, clean_tenant)

    # 1. Montar e validar contexto XFILIAL
    op_context = build_protheus_context(empresa=empresa, filial=filial)


    # 3. Carregar as tabelas e campos do dicionário autorizados para o contexto/módulo
    context = build_dictionary_context(
        db=db,
        tenant_id=str(tenant_id),
        company_id=company_id,
        module_filter=module_filter
    )

    if not context:
        raise HTTPException(
            status_code=404, 
            detail="Nenhuma tabela liberada ou encontrada no snapshot do dicionário para os filtros informados."
        )

    context_text = render_context_for_prompt(context)
    allowed_table_names = {item["table"]["table_name"] for item in context}
    for item in context:
        if item["table"].get("physical_name"):
            allowed_table_names.add(item["table"]["physical_name"])

    # 4. Acionar provedor LLM com prompt contextualizado no Oracle e XFILIAL
    sql = await real_llm_sql_generator(
        prompt=str(prompt),
        context_text=context_text,
        empresa=op_context["empresa"],
        filial=op_context["filial"],
        xfilial=op_context["xfilial"],
        tenant_id=str(tenant_id)
    )

    # 5. Garantir verificação de segurança, bloqueio de mutações, filtro D_E_L_E_T_ e escopo das tabelas
    validate_query_security(sql=sql, allowed_tables=allowed_table_names, filial=op_context["xfilial"])

    response: Dict[str, Any] = {
        "status": "success",
        "tenant_id": str(tenant_id),
        "company_id": company_id,
        "context_operational": op_context,
        "tables_in_context": len(context),
        "sql": sql,
        "response_time_ms": int((time.time() - started) * 1000)
    }

    # 6. Priorização do endpoint /QueryRest na execução real, respeitando a não alucinação de dados
    if execute:
        try:
            rows = await queryrest_exec_tenant(
                db=db,
                tenant_id=str(tenant_id),
                company_id=company_id,
                query=sql
            )
            response["records"] = len(rows)
            response["data"] = rows[:500]  # Limite máximo seguro por requisição HTTP
            if len(rows) == 0:
                response["message"] = "A consulta ao banco Oracle do Protheus foi executada com sucesso, porém retornou zero registros (tabela vazia ou sem correspondências no período)."
        except HTTPException as http_ex:
            response["status"] = "execution_failed"
            response["execution_error"] = http_ex.detail
            # Em observância à regra de ouro do agente, em nenhuma circunstância simulamos ou inventamos dados compensatórios.

    return response
