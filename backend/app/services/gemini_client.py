import re
import os
import json
import httpx
import logging
from typing import Optional, AsyncGenerator
import asyncio
from app.core.config import settings
from app.services.protheus_service import descobrir_apis_protheus, execute_protheus_tool
from app.services.ollama_client import _analyze_tool_results, get_system_prompt

logger = logging.getLogger("app.gemini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

def get_candidate_gemini_models() -> list[str]:
    raw_configured = os.getenv("GEMINI_MODEL", "").strip() or getattr(settings, "gemini_model", "") or "gemini-2.0-flash"
    
    # Modelos estáveis e oficiais do Google Gemini
    valid_official_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    
    if raw_configured in valid_official_models:
        candidates = [raw_configured] + [m for m in valid_official_models if m != raw_configured]
    else:
        candidates = valid_official_models
        
    return candidates

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
                "parts": [{"text": m.get("text", m.get("content", ""))}]
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
        
    # A última mensagem DEVE ser a do usuário contendo a pergunta
    user_parts = [{"text": question}]
    
    if image:
        match = re.match(r"data:([^;]+);base64,(.+)", image)
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
    allow_tools: bool = True,
) -> str:
    if not GEMINI_API_KEY:
        return "**Erro:** A variável `GEMINI_API_KEY` não está configurada no ambiente."

    contents = _build_gemini_messages(question, protheus_data, intent, context, history, image)
    
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    tenant_id = context.get("tenant_id", "default") if context else "default"
    
    # Usar system_prompt personalizado do tenant, se existir
    tenant_system_prompt = context.get("tenant_system_prompt") if context else None
    system_instruction_text = tenant_system_prompt if tenant_system_prompt else get_system_prompt(tenant_name, tenant_id)
    
    # Usar temperature personalizada do tenant, se existir
    tenant_temperature = context.get("tenant_temperature") if context else None
    generation_config = {}
    if tenant_temperature is not None:
        generation_config["temperature"] = tenant_temperature
    
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction_text}]
        },
    }
    if allow_tools:
        payload["tools"] = GEMINI_TOOLS
    if generation_config:
        payload["generationConfig"] = generation_config

    models_to_try = get_candidate_gemini_models()
    last_error_msg = ""

    async with httpx.AsyncClient(timeout=35.0) as client:
        resp = None
        current_successful_model = None
        
        for current_model in models_to_try:
            url = f"{GEMINI_BASE_URL}/models/{current_model}:generateContent?key={GEMINI_API_KEY}"
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    current_successful_model = current_model
                    break
                else:
                    last_error_msg = f"HTTP {resp.status_code} - {resp.text[:300]}"
                    logger.warning("Gemini API (%s) status=%s. Tentando próximo modelo...", current_model, resp.status_code)
                    resp = None
                    continue
            except httpx.RequestError as e:
                last_error_msg = str(e)
                logger.warning("Erro de conexão com Gemini (%s): %s", current_model, e)
                resp = None
                continue

        if resp is None or getattr(resp, "status_code", 200) != 200:
            if "503" in last_error_msg:
                return "A inteligência artificial do Google (Gemini) está temporariamente indisponível ou sobrecarregada (Erro 503). Por favor, tente novamente."
            return f"Erro na API do Gemini: {last_error_msg}"
            
        resp_json = resp.json()
        
        candidate = resp_json.get("candidates", [{}])[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        
        # Verificar chamada de ferramenta
        tool_calls = [p.get("functionCall") for p in parts if "functionCall" in p]
        
        if tool_calls:
            contents.append(content)
            tool_results = []
            for call in tool_calls:
                name = call.get("name")
                args = call.get("args", {})
                
                logger.info("Gemini solicitou ferramenta: %s com args %s", name, args)
                
                if name == "consultar_protheus":
                    endpoint = args.get("endpoint", "")
                    query_params = args.get("query_params", {})
                    tenant_id = context.get("tenant_id", "default") if context else "default"
                    tool_result = await execute_protheus_tool(
                        endpoint,
                        query_params,
                        tenant_id=tenant_id,
                        context=context,
                    )
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
                
            payload["contents"] = contents
            
            try:
                active_model = current_successful_model or "gemini-2.0-flash"
                follow_up_url = f"{GEMINI_BASE_URL}/models/{active_model}:generateContent?key={GEMINI_API_KEY}"
                follow_up_resp = await client.post(follow_up_url, json=payload)
                if follow_up_resp.status_code == 200:
                    fu_candidate = follow_up_resp.json().get("candidates", [{}])[0]
                    fu_parts = fu_candidate.get("content", {}).get("parts", [])
                    return "\n".join([p.get("text", "") for p in fu_parts if "text" in p])
            except Exception as e:
                logger.error("Erro na segunda chamada do Gemini com tool results: %s", e)
                return _analyze_tool_results(tool_results, question)

        return "\n".join([p.get("text", "") for p in parts if "text" in p])

async def stream_gemini(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    image: Optional[str] = None,
    allow_tools: bool = True,
) -> AsyncGenerator[str, None]:
    if not GEMINI_API_KEY:
        yield "**Erro:** A variável `GEMINI_API_KEY` não está configurada no ambiente."
        return

    contents = _build_gemini_messages(question, protheus_data, intent, context, history, image)
    
    tenant_name = context.get("company", "Empresa") if context else "Empresa"
    tenant_id = context.get("tenant_id", "default") if context else "default"
    
    tenant_system_prompt = context.get("tenant_system_prompt") if context else None
    system_instruction_text = tenant_system_prompt if tenant_system_prompt else get_system_prompt(tenant_name, tenant_id)
    
    tenant_temperature = context.get("tenant_temperature") if context else None
    generation_config = {}
    if tenant_temperature is not None:
        generation_config["temperature"] = tenant_temperature
    
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction_text}]
        },
    }
    if allow_tools:
        payload["tools"] = GEMINI_TOOLS
    if generation_config:
        payload["generationConfig"] = generation_config

    models_to_try = get_candidate_gemini_models()
    last_error_msg = ""

    async with httpx.AsyncClient(timeout=35.0) as client:
        resp = None
        current_successful_model = None

        for current_model in models_to_try:
            url = f"{GEMINI_BASE_URL}/models/{current_model}:generateContent?key={GEMINI_API_KEY}"
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    current_successful_model = current_model
                    break
                else:
                    last_error_msg = f"HTTP {resp.status_code} - {resp.text[:300]}"
                    logger.warning("Gemini (Stream) API (%s) status=%s. Tentando próximo modelo...", current_model, resp.status_code)
                    resp = None
                    continue
            except httpx.RequestError as e:
                last_error_msg = str(e)
                logger.warning("Erro de conexão com Gemini (Stream) (%s): %s", current_model, e)
                resp = None
                continue

        if resp is None or getattr(resp, "status_code", 200) != 200:
            if "503" in last_error_msg:
                yield "A inteligência artificial do Google (Gemini) está temporariamente indisponível ou sobrecarregada (Erro 503). Por favor, tente novamente."
            else:
                yield f"Erro na API do Gemini: {last_error_msg}"
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
                
                logger.info("Gemini (Stream) solicitou ferramenta: %s com args %s", name, args)
                
                if name == "consultar_protheus":
                    endpoint = args.get("endpoint", "")
                    query_params = args.get("query_params", {})
                    tenant_id = context.get("tenant_id", "default") if context else "default"
                    tool_result = await execute_protheus_tool(
                        endpoint,
                        query_params,
                        tenant_id=tenant_id,
                        context=context,
                    )
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
                
            payload["contents"] = contents
            
            try:
                active_model = current_successful_model or "gemini-2.0-flash"
                stream_url = f"{GEMINI_BASE_URL}/models/{active_model}:streamGenerateContent?key={GEMINI_API_KEY}&alt=sse"
                async with client.stream("POST", stream_url, json=payload, timeout=60.0) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str and data_str != "[DONE]":
                                try:
                                    chunk_json = json.loads(data_str)
                                    chunk_candidate = chunk_json.get("candidates", [{}])[0]
                                    chunk_parts = chunk_candidate.get("content", {}).get("parts", [])
                                    for p in chunk_parts:
                                        if "text" in p:
                                            yield p["text"]
                                except Exception:
                                    pass
            except Exception as e:
                logger.error("Erro no stream de follow-up do Gemini: %s", e)
                yield _analyze_tool_results(tool_results, question)
        else:
            for p in parts:
                if "text" in p:
                    yield p["text"]
