
import re
import os
import time
import httpx
import json
import base64
from typing import Optional
from app.core.config import settings
from app.services.protheus_service import descobrir_apis_protheus, execute_protheus_tool

OLLAMA_URL   = settings.ollama_url
OLLAMA_MODEL = settings.ollama_model
LLM_BACKEND  = settings.llm_backend

def _log_token_usage_background(tenant_id: str, request_type: str, prompt_tokens: int, completion_tokens: int, model_name: str):
    try:
        from app.db.database import SessionLocal
        from app.models.knowledge import ApiUsageLog, Company
        db = SessionLocal()
        company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
        if company:
            log = ApiUsageLog(
                company_id=company.id,
                session_id=None,
                request_type=request_type,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                model_name=model_name
            )
            db.add(log)
            db.commit()
        db.close()
    except Exception as e:
        print(f"Failed to log tokens: {e}")

def get_system_prompt(tenant_name: str = "Empresa", tenant_id: str = "default"):
    from datetime import datetime
    hoje_str = datetime.now().strftime("%d/%m/%Y")
    hoje_db = datetime.now().strftime("%Y%m%d")
    
    base_prompt = f"""Voce e o Copilot Protheus, especialista no ERP TOTVS Protheus ({tenant_name}, banco Oracle).
Seu objetivo eh responder perguntas usando dados reais do sistema chamando as ferramentas (tools) disponiveis.
HOJE EH {hoje_str} (formato banco: {hoje_db}). Use essa data exata como referencia para qualquer calculo de "hoje", "ontem", "proximos X dias" ou "ultimos X dias".

====================
CONHECIMENTO E VISAO (IMPORTANTE):
- Voce e um grande especialista no Protheus. Alem de consultar o banco, voce DEVE responder perguntas sobre como o sistema funciona, explicar rotinas (como o Novo Gestor Financeiro, Faturamento, Compras, etc), dar treinamentos e tirar duvidas conceituais do usuario. Nunca diga que nao sabe ou que esta limitado apenas a consultar dados.
- VOCE POSSUI VISAO COMPUTACIONAL! Quando o usuario pedir para analisar a tela atual, uma imagem (screenshot) sera enviada. Voce PODE e DEVE olhar a imagem, extrair os numeros, paineis, grids, tabelas e filtros visiveis e formular sua resposta baseada exclusivamente no que voce esta vendo na tela.

====================
DIRETRIZES RESTRITAS DE SQL (PROTHEUS):
- Permitido apenas: SELECT, WITH, GROUP BY, HAVING, ORDER BY, SUM, COUNT, MAX, MIN, AVG.
- PROIBIDO: UPDATE, DELETE, TRUNCATE, DROP, ALTER, MERGE, INSERT, CALL, EXEC, BEGIN.
- NUNCA use SELECT *. Sempre especifique os campos exatos.
- SEMPRE filtre registros válidos: WHERE D_E_L_E_T_ <> '*'. NUNCA espace o nome D_E_L_E_T_.
- A chave de filial (*_FILIAL) deve ser filtrada se USA_FILIAL='S'. Respeite a hierarquia de empresa/unidade/filial baseada nas configurações.
- JOINs devem sempre priorizar o Índice Principal (SIX/X2_UNICO). NUNCA inferir JOIN por X3_RELACAO.
- NUNCA acesse tabelas SYS (SYS_COMPANY) sem autorização explicita.
- Para obter dados, chame 'consultar_protheus' com endpoint="QueryRest" e query_params={{"cQuery": "sua query SQL"}}.
- NUNCA use SELECT TOP. Limite linhas com: WHERE ROWNUM <= 1000 ou FETCH FIRST 1000 ROWS ONLY no final.
- Datas no Protheus sao strings 'YYYYMMDD' (ex: 30/06/2026 eh '20260630').

====================
DICIONARIO DE DADOS (TENANT ATUAL):
"""
    try:
        from app.db.database import SessionLocal
        from app.models.knowledge import DictionaryTable, DictionaryField
        
        db = SessionLocal()
        import uuid
        try:
            tid = uuid.UUID(tenant_id)
        except:
            tid = None
            
        if tid:
            tid = str(tid)
            from app.db.database import get_tenant_session
            db_tenant = get_tenant_session(tid)
            try:
                tables = db_tenant.query(DictionaryTable).all()
                if tables:
                    for t in tables:
                        base_prompt += f"- Tabela: {t.table_name} - {t.description or 'Sem descricao'}\n"
                        fields = db_tenant.query(DictionaryField).filter(DictionaryField.table_code == t.table_code).limit(50).all()
                        campos_str = ", ".join([f"{f.field_name} ({f.field_type}): {f.title or ''}" for f in fields])
                        if campos_str:
                            base_prompt += f"  Campos: {campos_str}\n\n"
                else:
                    base_prompt += "Nenhuma tabela liberada ou sincronizada para este tenant.\n"
            finally:
                db_tenant.close()
        db.close()
    except Exception as e:
        print(f"Erro ao buscar schemas no banco: {e}")
        base_prompt += "Erro ao carregar dicionario de dados.\n"

    base_prompt += """
====================
EXEMPLOS DE CHAMADAS (FEW-SHOT):
- Pergunta: "gerar relatorio de faturamento de 30/06/2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT SUM(F2_VALBRUT) AS TOTAL FROM SF2010 WHERE D_E_L_E_T_ = ' ' AND F2_FILIAL = '0101' AND F2_EMISSAO = '20260630'"})
- Pergunta: "vendas por produto em 30/06/2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT D2_COD, SUM(D2_TOTAL) AS TOTAL_PROD, SUM(D2_QUANT) AS QTD_PROD FROM SD2010 WHERE D_E_L_E_T_ = ' ' AND D2_FILIAL = '0101' AND D2_EMISSAO = '20260630' GROUP BY D2_COD ORDER BY TOTAL_PROD DESC"})
- Pergunta: "clientes mais ativos em junho de 2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT F2_CLIENTE, SUM(F2_VALBRUT) AS TOTAL_COMPRADO FROM SF2010 WHERE D_E_L_E_T_ = ' ' AND F2_FILIAL = '0101' AND F2_EMISSAO >= '20260601' AND F2_EMISSAO <= '20260630' GROUP BY F2_CLIENTE ORDER BY TOTAL_COMPRADO DESC"})
- Pergunta: "gerar relatorio de fluxo de caixa dos proximos 6 dias"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT 'RECEBIMENTOS' AS TIPO, E1_VENCTO AS DATA, SUM(E1_SALDO) AS TOTAL FROM SE1010 WHERE D_E_L_E_T_ = ' ' AND E1_FILIAL = '0101' AND E1_VENCTO >= '20260712' AND E1_VENCTO <= '20260717' AND E1_SALDO > 0 GROUP BY E1_VENCTO UNION ALL SELECT 'PAGAMENTOS' AS TIPO, E2_VENCTO AS DATA, SUM(E2_SALDO) AS TOTAL FROM SE2010 WHERE D_E_L_E_T_ = ' ' AND E2_FILIAL = '0101' AND E2_VENCTO >= '20260712' AND E2_VENCTO <= '20260717' AND E2_SALDO > 0 GROUP BY E2_VENCTO ORDER BY DATA, TIPO"})

====================
APRESENTACAO DO RESULTADO (EXTREMAMENTE IMPORTANTE):
- Voce DEVE responder SEMPRE utilizando o seguinte formato JSON rigoroso. NUNCA responda em texto livre fora do JSON.
- O JSON deve conter a estrutura de camadas para que o frontend exiba a informacao de forma estruturada.
- Se o usuario pedir apenas para bater papo, preencha o campo "executive_summary" e deixe os outros vazios.

Formato JSON OBRIGATORIO:
```json
{
  "executive_summary": "Resumo executivo claro e direto em markdown. Ex: 'Ha 5 vencimentos nos proximos 5 dias...'",
  "applied_filters": ["Filial: 0101", "Periodo: 2026-06", "Cliente: 000001"],
  "details": "Detalhamento completo (tabelas markdown, analises profundas, explicacoes detalhadas).",
  "technical_sql": "A query SQL exata que foi gerada e executada, se houver.",
  "kpis": [
    {"label": "Qtd Titulos", "value": "15", "color": "blue"},
    {"label": "Valor Total", "value": "R$ 50.000,00", "color": "green"},
    {"label": "Maior Risco", "value": "R$ 15.000,00", "color": "red"}
  ],
  "action_buttons": [
    {"label": "Abrir Rotina (FINA040)", "action": "open_routine", "payload": "FINA040"},
    {"label": "Exportar Excel", "action": "export_excel", "payload": ""}
  ],
  "titulo": "Titulo Opcional (se for um Dashboard)",
  "tipo_grafico": "bar" (ou "line", "pie", null se nao for grafico),
  "labels": ["Item 1", "Item 2"],
  "datasets": [{"label": "Nome da Serie", "dados": [10, 20]}],
  "insights": "Texto com a analise dos graficos (opcional)."
}
```
- A cor dos KPIs deve ser "red" (risco/negativo), "green" (positivo), "yellow" (alerta) ou "blue" (neutro).
- NUNCA invente dados ficticios.
"""
    return base_prompt

# Maintain backwards compatibility for imports that expect SYSTEM_PROMPT constant
SYSTEM_PROMPT = get_system_prompt()

def _build_messages(question, protheus_data, intent, context, history, image=None):
    import json
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    tenant_id = context.get("tenant_id", "default") if context else "default"
    
    # Usar system_prompt personalizado do tenant, se existir
    tenant_system_prompt = context.get("tenant_system_prompt") if context else None
    system_prompt_text = tenant_system_prompt if tenant_system_prompt else get_system_prompt(tenant_name, tenant_id)
    
    msgs = [{"role": "system", "content": system_prompt_text}]
    if context:
        parts = []
        for k, label in [
            ("module","Modulo"),("environment","Ambiente"),("company","Empresa"),
            ("branch","Filial"),("user","Usuario"),("pedido","Pedido ativo"),
            ("cliente","Cliente"),("produto","Produto"),("fornecedor","Fornecedor"),
        ]:
            if context.get(k):
                parts.append(f"{label}: {context[k]}")
        if parts:
            msgs.append({"role":"system","content":"Contexto Protheus:\n"+"\n".join(parts)})
        if context.get("screen_text"):
            msgs.append({"role":"system","content":f"Texto capturado da tela atual do sistema:\n{context['screen_text']}"})
        if context.get("document_context"):
            msgs.append({"role":"system","content":f"Base de Conhecimento (Documentos):\n{context['document_context']}"})
        if context.get("memory_context"):
            msgs.append({"role":"system","content":f"Memoria Persistente:\n{context['memory_context']}"})
    if protheus_data:
        msgs.append({"role":"system","content":f"Dados Protheus (intencao: {intent}):\n{json.dumps(protheus_data,ensure_ascii=False,indent=2)}"})
    if history:
        for m in history[-6:]:
            msgs.append({"role":m.get("role","user"),"content":m.get("text","")})
            
    if image:
        import re
        match = re.match(r"data:(image/\w+);base64,(.+)", image)
        if match:
            msgs.append({"role":"user", "content":question, "images": [match.group(2)]})
        else:
            msgs.append({"role":"user", "content":question})
    else:
        msgs.append({"role":"user","content":question})
        
    return msgs


async def _check_ollama_models() -> list:
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []


def _fallback_response(models: list) -> str:
    if not models:
        return (
            "**LLM offline** — nenhum modelo encontrado no Ollama.\n\n"
            "Execute no PowerShell para ativar:\n"
            "```\nollama pull mistral\n```\n"
            "Apos o download (~4 GB) o assistente responde automaticamente."
        )
    return (
        f"**Modelo '{OLLAMA_MODEL}' nao encontrado.**\n\n"
        f"Modelos disponiveis: `{', '.join(models)}`\n\n"
        f"Edite `backend/.env` e defina:\n"
        f"```\nOLLAMA_MODEL={models[0]}\n```"
    )



TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "consultar_protheus",
            "description": "Consulta o portal REST do ERP Protheus. Use para rodar SQL nativo via QueryRest ou consultar outras rotas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "endpoint": {
                        "type": "string",
                        "description": "O endpoint da API sem barra, ex: 'QueryRest', 'SaldoRest', 'TitulosRest'"
                    },
                    "query_params": {
                        "type": "object",
                        "description": "Parametros em JSON, ex: {\"cQuery\": \"SELECT...\"} para QueryRest, ou {\"cliente\": \"000001\"}"
                    }
                },
                "required": ["endpoint"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "descobrir_apis_protheus",
            "description": "Busca endpoints disponiveis no portal REST do Protheus atraves de uma palavra-chave. Use quando nao souber qual endpoint chamar na ferramenta consultar_protheus.",
            "parameters": {
                "type": "object",
                "properties": {
                    "palavra_chave": {
                        "type": "string",
                        "description": "Termo em ingles ou portugues para buscar a API, ex: 'stock', 'kardex', 'customer', 'invoice', 'pedido'"
                    }
                },
                "required": ["palavra_chave"]
            }
        }
    }
]




def _analyze_tool_results(tool_results: list) -> str:
    if not tool_results:
        return "empty"
    for content in tool_results:
        if not content or not content.strip():
            continue
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                if len(parsed) > 0:
                    first = parsed[0]
                    if isinstance(first, dict) and ("error" in first or "message" in first and "Nenhuma API" in first.get("message", "")):
                        return "error"
                    return "success"
                return "empty"
            elif isinstance(parsed, dict):
                if "items" in parsed and isinstance(parsed["items"], list):
                    if len(parsed["items"]) > 0:
                        return "success"
                    return "empty"
                if any(isinstance(v, list) and len(v) > 0 for v in parsed.values()):
                    return "success"
                if "error" in parsed or "message" in parsed:
                    return "error"
                # se eh dict mas nao tem items nem list
                if len(parsed) > 0:
                    return "success"
                return "empty"
        except:
            content_lower = content.lower()
            if "error" in content_lower or "failed" in content_lower or "no content" in content_lower or "empty" in content_lower:
                return "error"
            return "success"
    return "empty"


async def _call_ollama(messages: list, tenant_id: str = "default", context: Optional[dict] = None) -> str:
    # Usar temperature personalizada do tenant, se existir
    temperature = 0.0
    if context and context.get("tenant_temperature") is not None:
        temperature = context["tenant_temperature"]
    
    async with httpx.AsyncClient(timeout=180.0) as client:
        payload = {
            "model": OLLAMA_MODEL, 
            "messages": messages, 
            "stream": False, 
            "keep_alive": 0,
            "tools": TOOLS,
            "options": {
                "temperature": temperature
            }
        }
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        if resp.status_code == 400:
            if "does not support tools" in resp.text:
                print(f"Modelo {OLLAMA_MODEL} nao suporta tools. Fazendo fallback...")
                payload.pop("tools", None)
                resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
                resp.raise_for_status()
            else:
                resp.raise_for_status()
        elif resp.status_code != 200:
            print(f"Ollama API Error: {resp.status_code} - {resp.text}")
            resp.raise_for_status()
        
        resp_json = resp.json()
        message = resp_json.get("message", {})
        
        if "tool_calls" in message and message["tool_calls"]:
            messages.append(message)
            tool_results = []
            for tool_call in message["tool_calls"]:
                tool_call_id = tool_call.get("id")
                func = tool_call.get("function", {})
                name = func.get("name")
                args = func.get("arguments", {})
                if name == "consultar_protheus":
                    endpoint = args.get("endpoint", "")
                    query_params = args.get("query_params", {})
                    tool_result = await execute_protheus_tool(endpoint, query_params, tenant_id=tenant_id, context=context)
                    tool_results.append(tool_result)
                    messages.append({
                        "role": "tool",
                        "content": tool_result,
                        "tool_call_id": tool_call_id
                    })
                elif name == "descobrir_apis_protheus":
                    palavra_chave = args.get("palavra_chave", "")
                    tool_result = await descobrir_apis_protheus(palavra_chave)
                    tool_results.append(tool_result)
                    messages.append({
                        "role": "tool",
                        "content": tool_result,
                        "tool_call_id": tool_call_id
                    })
            
            analysis_result = _analyze_tool_results(tool_results)
            if analysis_result == "success":
                    messages.append({
                        "role": "system",
                        "content": "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
                    })
            elif analysis_result == "error":
                tenant_name = context.get("company", "Empresa") if context else "Empresa"
                messages.append({
                    "role": "system",
                    "content": f"INSTRUCAO: A consulta no Protheus falhou com um ERRO. Retorne um JSON preenchendo o 'executive_summary' informando que ocorreu um erro ao consultar o ERP e tente descrever o erro em linguagem amigavel. NUNCA invente ou simule dados ficticios."
                })
            else: # empty
                tenant_name = context.get("company", "Empresa") if context else "Empresa"
                messages.append({
                    "role": "system",
                    "content": f"INSTRUCAO: A consulta no Protheus retornou VAZIA (0 registros). Isso significa que nao ha dados para os filtros ou o periodo informado. Retorne um JSON preenchendo o 'executive_summary' informando exatamente que 'Não foram encontrados dados para esta consulta no ERP'. Não diga que 'a consulta retornou apenas a confirmação', diga apenas que não há dados no momento. NUNCA invente ou simule dados ficticios."
                })
            
            payload["messages"] = messages
            payload.pop("tools", None)
            
            resp2 = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp2.raise_for_status()
            r2_json = resp2.json()
            if "prompt_eval_count" in r2_json:
                _log_token_usage_background(tenant_id, "chat_with_tools", r2_json.get("prompt_eval_count", 0), r2_json.get("eval_count", 0), OLLAMA_MODEL)
            return r2_json["message"]["content"]
            
        if "prompt_eval_count" in resp_json:
            _log_token_usage_background(tenant_id, "chat", resp_json.get("prompt_eval_count", 0), resp_json.get("eval_count", 0), OLLAMA_MODEL)
        return message.get("content", "")


async def _call_ovms(messages: list) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/v3/chat/completions",
            json={"model": OLLAMA_MODEL, "messages": messages},
            headers={"Content-Type": "application/json"}
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def ask_llm(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    image: Optional[str] = None,
) -> str:
    messages = _build_messages(question, protheus_data, intent, context, history, image)
    try:
        tenant_id = context.get("tenant_id", "default") if context else "default"
        if LLM_BACKEND == "ovms":
            return await _call_ovms(messages)
        return await _call_ollama(messages, tenant_id=tenant_id, context=context)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            models = await _check_ollama_models()
            return _fallback_response(models)
        return f"Erro HTTP {e.response.status_code} ao chamar o LLM."
    except httpx.ConnectError:
        return (
            "**LLM offline** — nao foi possivel conectar ao Ollama.\n\n"
            "Verifique:\n"
            "```\nInvoke-RestMethod http://localhost:11434\n```"
        )
    except Exception as e:
        return f"Erro inesperado: {str(e)}"


async def stream_llm(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    image: Optional[str] = None,
):
    messages = _build_messages(question, protheus_data, intent, context, history, image)
    
    if LLM_BACKEND == "ovms":
        yield await _call_ovms(messages)
        return

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            payload = {
                "model": OLLAMA_MODEL, 
                "messages": messages, 
                "stream": False, 
                "keep_alive": 0,
                "tools": TOOLS,
                "options": {
                    "temperature": 0.0
                }
            }
            
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            resp_json = resp.json()
            message = resp_json.get("message", {})
            
            if "tool_calls" in message and message["tool_calls"]:
                messages.append(message)
                tool_results = []
                for tool_call in message["tool_calls"]:
                    tool_call_id = tool_call.get("id")
                    func = tool_call.get("function", {})
                    name = func.get("name")
                    args = func.get("arguments", {})
                    if name == "consultar_protheus":
                        endpoint = args.get("endpoint", "")
                        query_params = args.get("query_params", {})
                        tenant_id = context.get("tenant_id", "default") if context else "default"
                        tool_result = await execute_protheus_tool(endpoint, query_params, tenant_id=tenant_id, context=context)
                        tool_results.append(tool_result)
                        messages.append({
                            "role": "tool",
                            "content": tool_result,
                            "tool_call_id": tool_call_id
                        })
                    elif name == "descobrir_apis_protheus":
                        palavra_chave = args.get("palavra_chave", "")
                        tool_result = await descobrir_apis_protheus(palavra_chave)
                        tool_results.append(tool_result)
                        messages.append({
                            "role": "tool",
                            "content": tool_result,
                            "tool_call_id": tool_call_id
                        })
                
                if _has_real_data(tool_results):
                    messages.append({
                        "role": "system",
                        "content": "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
                    })
                else:
                    tenant_name = context.get("company", "Empresa") if context else "Empresa"
                    messages.append({
                        "role": "system",
                        "content": f"INSTRUCAO: A consulta no Protheus nao retornou nenhum dado real para a sua busca (tabela vazia, erro ou sem correspondencias). Retorne um JSON preenchendo apenas o 'executive_summary' informando que nao foram encontrados dados. NUNCA invente ou simule dados ficticios."
                    })
                
                payload["messages"] = messages
                payload.pop("tools", None)
            
            payload["stream"] = True
            
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as stream_resp:
                async for line in stream_resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                    except Exception:
                        pass
    except httpx.ConnectError:
        yield "**LLM offline** — nao foi possivel conectar ao Ollama para streaming."
    except Exception as e:
        yield f"Erro inesperado no stream: {str(e)}"

