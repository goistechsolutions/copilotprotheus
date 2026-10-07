from typing import Optional, AsyncGenerator
import json
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

async def ask_openai(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    temperature: float = 0.2
) -> str:
    """Faz uma pergunta completa para uma API compatível com OpenAI e retorna o texto completo."""
    base_url = getattr(settings, "openai_base_url", "http://127.0.0.1:8000/v1")
    model = getattr(settings, "openai_model", "phi35")
    api_key = getattr(settings, "openai_api_key", "sk-local")
    
    messages = []
    
    # 1. System Prompt
    system_prompt = "Você é o Copilot Protheus, um assistente corporativo especialista em ERP."
    if intent:
        system_prompt += f" A intenção atual identificada é: {intent}."
    messages.append({"role": "system", "content": system_prompt})
    
    # 2. History
    if history:
        for msg in history:
            role = "user" if msg.get("sender") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
            
    # 3. Context & Data
    context_text = ""
    if context:
        context_text += f"Contexto de Tela: {json.dumps(context)}\n"
    if protheus_data:
        context_text += f"Dados do ERP: {json.dumps(protheus_data)}\n"
        
    final_content = f"{context_text}\nUsuário: {question}" if context_text else question
    messages.append({"role": "user", "content": final_content})
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": False
    }
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{base_url}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("[OpenAI] Erro ao chamar a API: %s", e)
            raise e

async def stream_openai(
    question: str,
    protheus_data: Optional[dict] = None,
    intent: Optional[str] = None,
    context: Optional[dict] = None,
    history: Optional[list] = None,
    temperature: float = 0.2
) -> AsyncGenerator[str, None]:
    """Faz uma pergunta completa para a API OpenAI em modo streaming (SSE)."""
    base_url = getattr(settings, "openai_base_url", "http://127.0.0.1:8000/v1")
    model = getattr(settings, "openai_model", "phi35")
    api_key = getattr(settings, "openai_api_key", "sk-local")
    
    messages = []
    system_prompt = "Você é o Copilot Protheus, um assistente corporativo especialista em ERP."
    if intent:
        system_prompt += f" A intenção atual identificada é: {intent}."
    messages.append({"role": "system", "content": system_prompt})
    
    if history:
        for msg in history:
            role = "user" if msg.get("sender") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
            
    context_text = ""
    if context:
        context_text += f"Contexto de Tela: {json.dumps(context)}\n"
    if protheus_data:
        context_text += f"Dados do ERP: {json.dumps(protheus_data)}\n"
        
    final_content = f"{context_text}\nUsuário: {question}" if context_text else question
    messages.append({"role": "user", "content": final_content})
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True
    }
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            async with client.stream("POST", f"{base_url}/chat/completions", json=payload, headers=headers) as stream_resp:
                stream_resp.raise_for_status()
                async for line in stream_resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0]["delta"]
                            if "content" in delta:
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error("[OpenAI Stream] Erro no stream: %s", e)
            yield "\n[A IA Local encontrou um problema e a resposta foi interrompida.]"

