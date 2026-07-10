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

def get_system_prompt(tenant_name: str = "Empresa"):
    base_prompt = f"""Voce e o Copilot Protheus, especialista no ERP TOTVS Protheus ({tenant_name}, banco Oracle).
Seu objetivo eh responder perguntas usando dados reais do sistema chamando as ferramentas (tools) disponiveis.

====================
DIRETRIZES DE TOOLS:
- Para obter faturamento, vendas, clientes ou relatorios, voce DEVE chamar 'consultar_protheus'.
- Para rodar consultas SQL no Oracle, chame 'consultar_protheus' com endpoint="QueryRest" e query_params={"cQuery": "sua query SQL"}.
- NUNCA use SELECT TOP. Para limitar linhas no Oracle, use a clausula WHERE ROWNUM <= N (nunca no final depois do ORDER BY), ou use FETCH FIRST N ROWS ONLY no final (ex: ORDER BY F2_DOC FETCH FIRST 3 ROWS ONLY).
- Datas no Protheus sao strings 'YYYYMMDD' (ex: 30/06/2026 eh '20260630'). NUNCA use TO_DATE.
- NUNCA use tabelas ficticias (como SA_VENDA, SA0102). Use estritamente as tabelas reais listadas abaixo.

====================
TABELAS REAIS DO BANCO (USE ESTAS INFORMACOES):
"""
    try:
        import json
        from pathlib import Path
        tables_path = Path("tables_config.json")
        if tables_path.exists():
            with open(tables_path, "r", encoding="utf-8") as f:
                tables = json.load(f)
            for idx, t in enumerate(tables, 1):
                base_prompt += f"{idx}. {t.get('description', '')}: {t.get('alias', '')} ({t.get('tipo', '')}: {t.get('fields', '')})\n"
        else:
            base_prompt += "1. FATURAMENTO/VENDAS: SF2010 (Cabecalho) e SD2010 (Itens)\n"
    except Exception:
        base_prompt += "1. FATURAMENTO/VENDAS: SF2010 (Cabecalho) e SD2010 (Itens)\n"

    base_prompt += """
====================
EXEMPLOS DE CHAMADAS (FEW-SHOT):
- Pergunta: "gerar relatorio de faturamento de 30/06/2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT SUM(F2_VALBRUT) AS TOTAL FROM SF2010 WHERE D_E_L_E_T_ = ' ' AND F2_FILIAL = '0101' AND F2_EMISSAO = '20260630'"})
- Pergunta: "vendas por produto em 30/06/2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT D2_COD, SUM(D2_TOTAL) AS TOTAL_PROD, SUM(D2_QUANT) AS QTD_PROD FROM SD2010 WHERE D_E_L_E_T_ = ' ' AND D2_FILIAL = '0101' AND D2_EMISSAO = '20260630' GROUP BY D2_COD ORDER BY TOTAL_PROD DESC"})
- Pergunta: "clientes mais ativos em junho de 2026"
  Acao: Chamar consultar_protheus(endpoint="QueryRest", query_params={"cQuery": "SELECT F2_CLIENTE, SUM(F2_VALBRUT) AS TOTAL_COMPRADO FROM SF2010 WHERE D_E_L_E_T_ = ' ' AND F2_FILIAL = '0101' AND F2_EMISSAO >= '20260601' AND F2_EMISSAO <= '20260630' GROUP BY F2_CLIENTE ORDER BY TOTAL_COMPRADO DESC"})

====================
EXPORTACAO DE ARQUIVOS (PDF E EXCEL):
- O Copilot Protheus possui uma barra de ferramentas com botoes de exportacao direta para Excel (📊 Excel) e PDF (📄 PDF) localizados na parte inferior do painel do chat, logo abaixo de qualquer resposta que contenha tabelas ou relatorios.
- Se o usuario pedir para gerar, exportar, converter ou fazer o download do resultado anterior ou de qualquer tabela em formato Excel ou PDF, informe-o claramente de que ele pode clicar diretamente nos botoes "📊 Excel" ou "📄 PDF" que aparecem logo abaixo da tabela no painel do Copilot para fazer o download do arquivo instantaneamente.

====================
APRESENTACAO DO RESULTADO:
- Apresente os dados em formato de RELATORIO GERENCIAL profissional com tabelas Markdown limpas, totais e insights.
- NUNCA invente dados ou use dados de exemplo. Se nao houver dados reais, informe claramente.
- TRANSPARENCIA DE CONSULTAS SQL (OBRIGATORIO): No final da resposta, inclua a nota tecnica mostrando a query utilizada no seguinte formato:
---
**Consulta SQL Executada:**
```sql
[Consulta SQL exata gerada para a tool]
```"""
    return base_prompt

# Maintain backwards compatibility for imports that expect SYSTEM_PROMPT constant
SYSTEM_PROMPT = get_system_prompt()

def _build_messages(question, protheus_data, intent, context, history):
    import json
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    msgs = [{"role": "system", "content": get_system_prompt(tenant_name)}]
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




def _has_real_data(tool_results: list) -> bool:
    for content in tool_results:
        if not content or not content.strip():
            continue
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                if len(parsed) > 0:
                    first = parsed[0]
                    if isinstance(first, dict) and ("error" in first or "message" in first and "Nenhuma API" in first.get("message", "")):
                        continue
                    return True
            elif isinstance(parsed, dict):
                if "items" in parsed and isinstance(parsed["items"], list) and len(parsed["items"]) > 0:
                    return True
                if any(isinstance(v, list) and len(v) > 0 for v in parsed.values()):
                    return True
                if "error" in parsed or "message" in parsed:
                    continue
                return True
        except:
            content_lower = content.lower()
            if "error" in content_lower or "failed" in content_lower or "no content" in content_lower or "empty" in content_lower:
                continue
            return True
    return False


async def _call_ollama(messages: list, tenant_id: str = "default", context: Optional[dict] = None) -> str:
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
            
            if _has_real_data(tool_results):
                messages.append({
                    "role": "system",
                    "content": "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente-os diretamente como um relatorio executivo profissional com tabelas Markdown limpas, totais e insights. NAO gere codigo, scripts ou tutoriais. NAO explique como obter os dados. Apresente os RESULTADOS."
                })
            else:
                tenant_name = context.get("company", "Empresa") if context else "Empresa"
                messages.append({
                    "role": "system",
                    "content": f"INSTRUCAO: A consulta no Protheus nao retornou nenhum dado real para a sua busca (tabela vazia, erro ou sem correspondencias). Informe claramente ao usuario que nao foram encontrados registros no banco de dados da empresa {tenant_name} para a pesquisa solicitada. NUNCA invente ou simule dados ficticios."
                })
            
            payload["messages"] = messages
            payload.pop("tools", None)
            
            resp2 = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp2.raise_for_status()
            return resp2.json()["message"]["content"]
            
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
) -> str:
    messages = _build_messages(question, protheus_data, intent, context, history)
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
):
    messages = _build_messages(question, protheus_data, intent, context, history)
    
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
                        "content": "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente-os diretamente como um relatorio executivo profissional com tabelas Markdown limpas, totais e insights. NAO gere codigo, scripts ou tutoriais. NAO explique como obter os dados. Apresente os RESULTADOS."
                    })
                else:
                    tenant_name = context.get("company", "Empresa") if context else "Empresa"
                    messages.append({
                        "role": "system",
                        "content": f"INSTRUCAO: A consulta no Protheus nao retornou nenhum dado real para a sua busca (tabela vazia, erro ou sem correspondencias). Informe claramente ao usuario que nao foram encontrados registros no banco de dados da empresa {tenant_name} para a pesquisa solicitada. NUNCA invente ou simule dados ficticios."
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

