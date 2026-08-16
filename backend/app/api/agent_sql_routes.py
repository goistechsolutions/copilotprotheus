import time
import re
import logging
from typing import Dict, Any, List
from app.services.tenant_resolver import resolve_clean_tenant
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import uuid
from sqlalchemy.orm import Session

from app.db.database import get_db, SessionLocal
from app.core.config import settings
from app.services.dictionary_context_service import (
    build_dictionary_context,
    render_context_for_prompt,
)
from app.services.protheus_context_service import build_protheus_context, validate_query_security
from app.services.protheus_service import get_tenant_config
from app.services.queryrest_service import queryrest_exec_tenant

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
    tenant_id: str = "default",
    image: str = None
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
                history=[],
                image=image
            )
        else:
            from app.services.ollama_client import ask_llm
            raw_response = await ask_llm(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={"tenant_system_prompt": system_instruction, "tenant_id": tenant_id},
                history=[],
                image=image
            )
    except Exception as e:
        logger.error(f"[SQL Generator] Falha ao acionar provedor LLM ({settings.llm_backend}): {e}")
        raise HTTPException(
            status_code=503, 
            detail=f"O serviço do provedor de IA ({settings.llm_backend}) está temporariamente indisponível para geração da consulta SQL. Erro: {str(e)}"
        )

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



async def process_agent_task(task_id: str, payload: dict):
    started = time.time()
    try:
        tenant_id = payload.get("tenant_id")
        if not tenant_id or tenant_id == "default":
            AGENT_TASKS[task_id] = {"status": "error", "error": "Desculpe, mas eu preciso estar aberto dentro do ERP Protheus (com um contexto válido) para executar consultas no banco de dados."}
            return
            
        company_id_raw = payload.get("company_id")
        if company_id_raw in ("", "default", "null", None):
            company_id_raw = None
            
        config = get_tenant_config(tenant_id, company_id_raw) if tenant_id != "default" else None
        company_id = config.get("company_id") if config else None
            
        prompt = payload.get("prompt") or payload.get("query")
        empresa = payload.get("empresa")
        filial = payload.get("filial")
        module_filter = payload.get("module_filter")
        execute = payload.get("execute", False)
        
        file_data = payload.get("file")
        image_b64 = file_data.get("data") if isinstance(file_data, dict) else None

        if not prompt:
            AGENT_TASKS[task_id] = {"status": "error", "error": "O campo prompt ou query é obrigatório na v2."}
            return

        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        
        with SessionLocal() as db:
            clean_tenant = resolve_clean_tenant(tenant_id)
            if clean_tenant and clean_tenant != "public":
                ensure_tenant_tables(db, clean_tenant)
                db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
                db.commit()

            # 0. Valida cota e limite diário
            from app.core.rate_limit import check_tenant_rate_limit
            rate_info = check_tenant_rate_limit(db, clean_tenant)

            # 1. Montar contexto XFILIAL
            op_context = build_protheus_context(empresa=empresa, filial=filial)

            # 3. Carregar dicionário
            context = build_dictionary_context(
                db=db,
                tenant_id=str(tenant_id),
                company_id=company_id,
                module_filter=module_filter
            )

            if not context:
                AGENT_TASKS[task_id] = {"status": "error", "error": "Nenhuma tabela liberada ou encontrada no snapshot do dicionário para os filtros informados."}
                return

            context_text = render_context_for_prompt(context)
            allowed_table_names = {item["table"]["table_name"] for item in context}
            for item in context:
                if item["table"].get("physical_name"):
                    allowed_table_names.add(item["table"]["physical_name"])

            # 4. LLM
            sql = await real_llm_sql_generator(
                prompt=str(prompt),
                context_text=context_text,
                empresa=op_context["empresa"],
                filial=op_context["filial"],
                xfilial=op_context["xfilial"],
                tenant_id=str(tenant_id),
                image=image_b64
            )

            # 5. Segurança
            validate_query_security(sql=sql, allowed_tables=allowed_table_names, filial=op_context["xfilial"])

            response = {
                "status": "success",
                "tenant_id": str(tenant_id),
                "company_id": company_id,
                "context_operational": op_context,
                "tables_in_context": len(context),
                "sql": sql,
                "response_time_ms": int((time.time() - started) * 1000)
            }

            # 6. QueryRest
            if execute:
                try:
                    rows = await queryrest_exec_tenant(
                        db=db,
                        tenant_id=str(tenant_id),
                        company_id=company_id,
                        query=sql
                    )
                    response["records"] = len(rows)
                    response["data"] = rows[:500]
                    if len(rows) == 0:
                        response["summary"] = "A consulta ao banco Oracle do Protheus foi executada com sucesso, porém retornou zero registros (tabela vazia ou sem correspondências no período)."
                    else:
                        if isinstance(rows, list) and len(rows) > 0 and isinstance(rows[0], dict):
                            headers = list(rows[0].keys())
                            md_table = "| " + " | ".join(headers) + " |\n"
                            md_table += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                            for row in rows[:500]:
                                md_table += "| " + " | ".join([str(row.get(h, "")).replace("\n", " ") for h in headers]) + " |\n"
                            response["summary"] = md_table
                        else:
                            response["summary"] = f"A consulta retornou {len(rows)} registros, mas o formato é inesperado."
                except HTTPException as http_ex:
                    response["status"] = "execution_failed"
                    response["execution_error"] = http_ex.detail

            AGENT_TASKS[task_id] = response

    except HTTPException as e:
        AGENT_TASKS[task_id] = {"status": "error", "error": e.detail}
    except Exception as e:
        logger.error(f"Erro no processamento da task {task_id}: {e}")
        AGENT_TASKS[task_id] = {"status": "error", "error": str(e)}

@router.post("/ask/v2")
async def ask_v2(payload: dict, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    # Checagem rapida de tenant antes de disparar task
    tenant_id = payload.get("tenant_id")
    if not tenant_id or tenant_id == "default":
        return {"summary": "Desculpe, mas eu preciso estar aberto dentro do ERP Protheus (com um contexto válido) para executar consultas no banco de dados."}

    task_id = str(uuid.uuid4())
    AGENT_TASKS[task_id] = {"status": "processing"}
    background_tasks.add_task(process_agent_task, task_id, payload)
    return {"status": "processing", "task_id": task_id}

@router.get("/ask/v2/status/{task_id}")
async def ask_v2_status(task_id: str):
    if task_id not in AGENT_TASKS:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    
    # Se erro for gerado, retornamos como JSON normal com 'summary' mapeado para o frontend renderizar
    if AGENT_TASKS[task_id].get("status") == "error":
        return {"status": "error", "summary": AGENT_TASKS[task_id].get("error")}
        
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
