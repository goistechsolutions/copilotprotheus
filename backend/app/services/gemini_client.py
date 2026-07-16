import os
import json
import httpx
import logging
from typing import Optional, AsyncGenerator
from app.core.config import settings
from app.services.protheus_service import descobrir_apis_protheus, execute_protheus_tool
from app.services.ollama_client import _has_real_data, get_system_prompt

logger = logging.getLogger("app.gemini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# Definição das ferramentas no formato da Gemini API
GEMINI_TOOLS = [
    {
        "functionDeclarations": [
            {
                "name": "consultar_protheus",
                "description": "Consulta o portal REST do ERP Protheus. Use para rodar SQL nativo via QueryRest ou consultar outras rotas.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "endpoint": {
                            "type": "STRING",
                            "description": "O endpoint da API sem barra, ex: 'QueryRest', 'SaldoRest', 'TitulosRest'"
                        },
                        "query_params": {
                            "type": "OBJECT",
                            "description": "Parametros em JSON, ex: {\"cQuery\": \"SELECT...\"} para QueryRest, ou {\"cliente\": \"000001\"}"
                        }
                    },
                    "required": ["endpoint"]
                }
            },
            {
                "name": "descobrir_apis_protheus",
                "description": "Busca endpoints disponiveis no portal REST do Protheus.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "palavra_chave": {
                            "type": "STRING",
                            "description": "Termo para buscar a API, ex: 'faturamento', 'pedido'"
                        }
                    },
                    "required": ["palavra_chave"]
                }
            }
        ]
    }
]

def _build_gemini_messages(question: str, protheus_data: Optional[dict], intent: Optional[str], context: Optional[dict], history: Optional[list], image: Optional[str] = None) -> list:
    """
    Constrói a lista de mensagens no formato da Gemini API.
    Nota: O system instruction é passado separadamente na Gemini API.
    """
    contents = []
    
    # Adicionar histórico se houver
    if history:
        for m in history[-6:]:
            role = "model" if m.get("role") == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m.get("text", "")}]
            })
            
    # Injetar contexto de dados/telas como mensagem de contexto (user)
    context_parts = []
    if context:
        parts = []
        for k, label in [
            ("module","Modulo"), ("environment","Ambiente"), ("company","Empresa"),
            ("branch","Filial"), ("user","Usuario"), ("pedido","Pedido ativo"),
            ("cliente","Cliente"), ("produto","Produto"), ("fornecedor","Fornecedor"),
        ]:
            if context.get(k):
                parts.append(f"{label}: {context[k]}")
        if parts:
            context_parts.append("Contexto Protheus:\n" + "\n".join(parts))
        if context.get("screen_text"):
            context_parts.append(f"Texto capturado da tela atual do sistema:\n{context['screen_text']}")
        if context.get("document_context"):
            context_parts.append(f"Base de Conhecimento (Documentos):\n{context['document_context']}")
        if context.get("memory_context"):
            context_parts.append(f"Memoria Persistente:\n{context['memory_context']}")
            
    if protheus_data:
        context_parts.append(f"Dados Protheus (intencao: {intent}):\n{json.dumps(protheus_data, ensure_ascii=False, indent=2)}")
        
    if context_parts:
        contents.append({
            "role": "user",
            "parts": [{"text": "\n\n".join(context_parts)}]
        })
        # Gemini requer que a última mensagem seja do usuário. Adicionamos a pergunta logo em seguida
        
    # A última mensagem DEVE ser a do usuário contendo a pergunta
    user_parts = [{"text": question}]
    
    if image:
        import re
        match = re.match(r"data:(image/\w+);base64,(.+)", image)
        if match:
            mime_type = match.group(1)
            b64_data = match.group(2)
            user_parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": b64_data
                }
            })

    contents.append({
        "role": "user",
        "parts": user_parts
    })
    
    return contents

async def ask_gemini(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    image: Optional[str] = None,
) -> str:
    if not GEMINI_API_KEY:
        return "**Erro:** A variável `GEMINI_API_KEY` não está configurada no ambiente."

    contents = _build_gemini_messages(question, protheus_data, intent, context, history, image)
    
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": get_system_prompt(tenant_name)}]
        },
        "tools": GEMINI_TOOLS
    }

    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                return "A inteligência artificial do Google (Gemini) está temporariamente indisponível ou sobrecarregada (Erro 503). Por favor, aguarde alguns instantes e tente novamente."
            return f"Erro na API do Gemini: {e.response.status_code} - {e.response.text}"
        except httpx.RequestError as e:
            return f"Erro de conexão com a API do Gemini: {str(e)}"
            
        resp_json = resp.json()
        
        candidate = resp_json.get("candidates", [{}])[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        
        # Verificar chamada de ferramenta
        tool_calls = [p.get("functionCall") for p in parts if "functionCall" in p]
        
        if tool_calls:
            # Adicionar a resposta do modelo (com o functionCall) ao histórico do chat
            contents.append(content)
            
            tool_results = []
            for call in tool_calls:
                name = call.get("name")
                args = call.get("args", {})
                
                logger.info(f"Gemini solicitou ferramenta: {name} com args {args}")
                
                if name == "consultar_protheus":
                    endpoint = args.get("endpoint", "")
                    query_params = args.get("query_params", {})
                    tenant_id = context.get("tenant_id", "default") if context else "default"
                    tool_result = await execute_protheus_tool(endpoint, query_params, tenant_id=tenant_id)
                elif name == "descobrir_apis_protheus":
                    palavra_chave = args.get("palavra_chave", "")
                    tool_result = await descobrir_apis_protheus(palavra_chave)
                else:
                    tool_result = json.dumps({"error": f"Ferramenta {name} nao implementada"})
                
                tool_results.append(tool_result)
                
                # Adicionar a resposta da ferramenta (role "function")
                contents.append({
                    "role": "function",
                    "parts": [{
                        "functionResponse": {
                            "name": name,
                            "response": {"output": tool_result}
                        }
                    }]
                })
                
            if _has_real_data(tool_results):
                instruction = "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
            else:
                instruction = "INSTRUCAO: A consulta no Protheus nao retornou nenhum dado real para a sua busca (tabela vazia, erro ou sem correspondencias). Retorne um JSON preenchendo apenas o 'executive_summary' informando que nao foram encontrados dados. NUNCA invente ou simule dados ficticios."
                
            contents.append({
                "role": "user",
                "parts": [{"text": instruction}]
            })
            
            # Segunda chamada para gerar a resposta baseada nos dados
            payload["contents"] = contents
            resp2 = await client.post(url, json=payload)
            resp2.raise_for_status()
            resp2_json = resp2.json()
            
            final_content = resp2_json.get("candidates", [{}])[0].get("content", {})
            final_text = "".join([p.get("text", "") for p in final_content.get("parts", [])])
            return final_text
            
        text = "".join([p.get("text", "") for p in parts if "text" in p])
        return text

async def stream_gemini(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    image: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Versão streaming para a API da Gemini.
    Caso solicite ferramenta, resolve-a em background e faz stream da resposta final.
    """
    if not GEMINI_API_KEY:
        yield "**Erro:** A variável `GEMINI_API_KEY` não está configurada no ambiente."
        return

    contents = _build_gemini_messages(question, protheus_data, intent, context, history, image)
    
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": get_system_prompt(tenant_name)}]
        },
        "tools": GEMINI_TOOLS
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Primeiro, fazemos chamada síncrona/não-stream para verificar se chamará ferramentas
        url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                yield "A inteligência artificial do Google (Gemini) está temporariamente indisponível ou sobrecarregada (Erro 503). Por favor, aguarde alguns instantes e tente novamente."
            else:
                yield f"Erro na API do Gemini: {e.response.status_code} - {e.response.text}"
            return
        except httpx.RequestError as e:
            yield f"Erro de conexão com a API do Gemini: {str(e)}"
            return
            
        resp_json = resp.json()
        
        candidate = resp_json.get("candidates", [{}])[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        
        tool_calls = [p.get("functionCall") for p in parts if "functionCall" in p]
        
        if tool_calls:
            contents.append(content)
            tool_results = []
            
            for call in tool_calls:
                name = call.get("name")
                args = call.get("args", {})
                
                logger.info(f"Gemini (Stream) solicitou ferramenta: {name} com args {args}")
                
                if name == "consultar_protheus":
                    endpoint = args.get("endpoint", "")
                    query_params = args.get("query_params", {})
                    tenant_id = context.get("tenant_id", "default") if context else "default"
                    tool_result = await execute_protheus_tool(endpoint, query_params, tenant_id=tenant_id)
                elif name == "descobrir_apis_protheus":
                    palavra_chave = args.get("palavra_chave", "")
                    tool_result = await descobrir_apis_protheus(palavra_chave)
                else:
                    tool_result = json.dumps({"error": f"Ferramenta {name} nao implementada"})
                
                tool_results.append(tool_result)
                
                contents.append({
                    "role": "function",
                    "parts": [{
                        "functionResponse": {
                            "name": name,
                            "response": {"output": tool_result}
                        }
                    }]
                })
                
            if _has_real_data(tool_results):
                instruction = "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
            else:
                instruction = "INSTRUCAO: A consulta no Protheus nao retornou nenhum dado real para a sua busca (tabela vazia, erro ou sem correspondencias). Retorne um JSON preenchendo apenas o 'executive_summary' informando que nao foram encontrados dados. NUNCA invente ou simule dados ficticios."
                
            contents.append({
                "role": "user",
                "parts": [{"text": instruction}]
            })
            
            payload["contents"] = contents
            
        # Agora sim, fazemos o stream da resposta final
        stream_url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:streamGenerateContent?key={GEMINI_API_KEY}"
        
        async with client.stream("POST", stream_url, json=payload) as stream_resp:
            buffer = ""
            async for chunk in stream_resp.aiter_text():
                buffer += chunk
                while True:
                    start = buffer.find("{")
                    if start == -1:
                        buffer = ""
                        break
                    
                    brace_count = 0
                    in_string = False
                    escape = False
                    end = -1
                    
                    for i in range(start, len(buffer)):
                        char = buffer[i]
                        if escape:
                            escape = False
                            continue
                        if char == "\\":
                            escape = True
                            continue
                        if char == '"':
                            in_string = not in_string
                            continue
                        if not in_string:
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    end = i
                                    break
                    
                    if end != -1:
                        json_str = buffer[start:end+1]
                        buffer = buffer[end+1:]
                        try:
                            data = json.loads(json_str)
                            chunk_parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                            chunk_text = "".join([p.get("text", "") for p in chunk_parts if "text" in p])
                            if chunk_text:
                                yield chunk_text
                        except Exception as e:
                            logger.error(f"Erro ao parsear JSON no stream: {e}")
                    else:
                        break
