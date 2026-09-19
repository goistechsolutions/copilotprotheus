import re
import os
import json
import httpx
import logging
from typing import Optional, AsyncGenerator
from fastapi import HTTPException
from app.core.config import settings
from app.services.protheus_service import descobrir_apis_protheus, execute_protheus_tool
from app.services.ollama_client import _analyze_tool_results, get_system_prompt

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
    
    # Adicionar histórico se houver — limitar tamanho para evitar 429 por excesso de tokens
    # Cada mensagem do histórico é truncada em 800 chars para evitar que respostas ricas em JSON
    # (executive_summary, kpis, datasets, etc.) inflacionem o payload na segunda pergunta.
    MAX_HISTORY_CHARS = 800
    if history:
        for m in history[-4:]:
            role = "model" if m.get("role") == "assistant" else "user"
            raw_text = m.get("text", m.get("content", "")) or ""
            # Trunca respostas longas do LLM (JSON com kpis, datasets, details, etc.)
            # para evitar estouro de quota na 2ª e subsequentes perguntas da conversa.
            truncated_text = raw_text[:MAX_HISTORY_CHARS]
            if len(raw_text) > MAX_HISTORY_CHARS:
                truncated_text += "... [resumido para contexto]"
            contents.append({
                "role": role,
                "parts": [{"text": truncated_text}]
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

    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 or "quota" in e.response.text.lower() or "rate-limit" in e.response.text.lower():
                logger.warning(
                    "[Gemini] Quota excedida (Erro 429) no Google Gemini: %s.",
                    e.response.text[:200]
                )
                # Se allow_tools=False significa modo geração SQL — NÃO fazer fallback para Ollama
                # (Ollama pode estar offline e causa 180s de timeout → loop infinito no frontend).
                # Lançar HTTPException para encerrar a task imediatamente com erro claro.
                if not allow_tools:
                    raise HTTPException(
                        status_code=429,
                        detail=(
                            "A cota da API do Gemini foi excedida (Erro 429). "
                            "Aguarde alguns instantes e tente novamente. "
                            "Se o problema persistir, verifique sua cota em console.cloud.google.com."
                        )
                    )
                # Modo chat assistente: tentar fallback para Ollama
                logger.info("[Gemini] Modo chat — ativando fallback para LLM Local (servidor Hetzner - Ollama)...")
                from app.services.ollama_client import ask_llm
                return await ask_llm(
                    question=question,
                    protheus_data=protheus_data,
                    intent=intent,
                    context=context,
                    history=history,
                    image=image,
                    allow_tools=allow_tools,
                )
            if e.response.status_code == 503:
                logger.warning("[Gemini] Erro 503 no Gemini.")
                if not allow_tools:
                    raise HTTPException(
                        status_code=503,
                        detail="O serviço do Gemini está temporariamente indisponível (503). Tente novamente em instantes."
                    )
                logger.info("[Gemini] Modo chat — ativando fallback para LLM Local (Hetzner)...")
                from app.services.ollama_client import ask_llm
                return await ask_llm(
                    question=question,
                    protheus_data=protheus_data,
                    intent=intent,
                    context=context,
                    history=history,
                    image=image,
                    allow_tools=allow_tools,
                )
            return f"Erro na API do Gemini: {e.response.status_code} - {e.response.text}"
        except httpx.RequestError as e:
            logger.warning("[Gemini] Erro de conexão com Gemini: %s.", e)
            if not allow_tools:
                raise HTTPException(
                    status_code=503,
                    detail=f"Não foi possível conectar ao serviço Gemini: {str(e)}"
                )

            from app.services.ollama_client import ask_llm
            return await ask_llm(
                question=question,
                protheus_data=protheus_data,
                intent=intent,
                context=context,
                history=history,
                image=image,
                allow_tools=allow_tools,
            )
            
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
                
            analysis_result = _analyze_tool_results(tool_results)
            if analysis_result == "success":
                instruction = "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
            elif analysis_result == "error":
                instruction = "INSTRUCAO: A consulta no Protheus falhou com um ERRO. Retorne um JSON preenchendo o 'executive_summary' informando que ocorreu um erro ao consultar o ERP e tente descrever o erro em linguagem amigavel. NUNCA invente ou simule dados ficticios."
            else:
                instruction = "INSTRUCAO: A consulta no Protheus retornou VAZIA (0 registros). Isso significa que nao ha dados para os filtros ou o periodo informado. Retorne um JSON preenchendo o 'executive_summary' informando exatamente que 'Não foram encontrados dados para esta consulta no ERP'. Não diga que 'a consulta retornou apenas a confirmação', diga apenas que não há dados no momento. NUNCA invente ou simule dados ficticios."
                
            contents.append({
                "role": "user",
                "parts": [{"text": instruction}]
            })
            
            # Segunda chamada para gerar a resposta baseada nos dados
            payload["contents"] = contents
            try:
                resp2 = await client.post(url, json=payload)
                resp2.raise_for_status()
            except httpx.HTTPStatusError as e2:
                if e2.response.status_code == 429 or "quota" in e2.response.text.lower() or "rate-limit" in e2.response.text.lower():
                    logger.warning("[Gemini] Erro 429 na resposta final da ferramenta. Ativando fallback para LLM Local (Hetzner)...")
                    from app.services.ollama_client import ask_llm
                    return await ask_llm(
                        question=question,
                        protheus_data=protheus_data,
                        intent=intent,
                        context=context,
                        history=history,
                        image=image,
                        allow_tools=False,
                    )
                raise
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
    allow_tools: bool = True,
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

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Primeiro, fazemos chamada síncrona/não-stream para verificar se chamará ferramentas
        url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 or "quota" in e.response.text.lower() or "rate-limit" in e.response.text.lower():
                logger.warning(
                    "[Gemini Stream] Quota excedida (Erro 429) no Google Gemini: %s. "
                    "Ativando fallback automático para LLM Local (servidor Hetzner - Ollama)...",
                    e.response.text[:200]
                )
                from app.services.ollama_client import stream_llm
                async for chunk in stream_llm(
                    question=question,
                    protheus_data=protheus_data,
                    intent=intent,
                    context=context,
                    history=history,
                    image=image,
                    allow_tools=allow_tools,
                ):
                    yield chunk
                return
            if e.response.status_code == 503:
                logger.warning("[Gemini Stream] Erro 503 no Gemini. Ativando fallback para LLM Local (Hetzner)...")
                from app.services.ollama_client import stream_llm
                async for chunk in stream_llm(
                    question=question,
                    protheus_data=protheus_data,
                    intent=intent,
                    context=context,
                    history=history,
                    image=image,
                    allow_tools=allow_tools,
                ):
                    yield chunk
                return
            yield f"Erro na API do Gemini: {e.response.status_code} - {e.response.text}"
            return
        except httpx.RequestError as e:
            logger.warning("[Gemini Stream] Erro de conexão com Gemini (%s). Fallback para LLM Local...", e)
            from app.services.ollama_client import stream_llm
            async for chunk in stream_llm(
                question=question,
                protheus_data=protheus_data,
                intent=intent,
                context=context,
                history=history,
                image=image,
                allow_tools=allow_tools,
            ):
                yield chunk
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
                
            analysis_result = _analyze_tool_results(tool_results)
            if analysis_result == "success":
                instruction = "INSTRUCAO: Os dados acima sao REAIS do Protheus. Apresente os resultados RETORNANDO EXCLUSIVAMENTE UM JSON conforme detalhado em 'APRESENTACAO DO RESULTADO' no seu system prompt. O JSON deve conter executive_summary, kpis, details, etc."
            elif analysis_result == "error":
                instruction = "INSTRUCAO: A consulta no Protheus falhou com um ERRO. Retorne um JSON preenchendo o 'executive_summary' informando que ocorreu um erro ao consultar o ERP e tente descrever o erro em linguagem amigavel. NUNCA invente ou simule dados ficticios."
            else:
                instruction = "INSTRUCAO: A consulta no Protheus retornou VAZIA (0 registros). Isso significa que nao ha dados para os filtros ou o periodo informado. Retorne um JSON preenchendo o 'executive_summary' informando exatamente que 'Não foram encontrados dados para esta consulta no ERP'. Não diga que 'a consulta retornou apenas a confirmação', diga apenas que não há dados no momento. NUNCA invente ou simule dados ficticios."
                
            contents.append({
                "role": "user",
                "parts": [{"text": instruction}]
            })
            
            payload["contents"] = contents
            
        # Agora sim, fazemos o stream da resposta final
        stream_url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:streamGenerateContent?key={GEMINI_API_KEY}"
        
        try:
            async with client.stream("POST", stream_url, json=payload) as stream_resp:
                if stream_resp.status_code == 429:
                    logger.warning("[Gemini Stream] 429 recebido em streamGenerateContent. Ativando fallback para LLM Local (Hetzner)...")
                    from app.services.ollama_client import stream_llm
                    async for chunk in stream_llm(
                        question=question,
                        protheus_data=protheus_data,
                        intent=intent,
                        context=context,
                        history=history,
                        image=image,
                        allow_tools=False,
                    ):
                        yield chunk
                    return

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
        except Exception as e_stream:
            logger.warning("[Gemini Stream] Falha durante streaming: %s. Ativando fallback para LLM Local (Hetzner)...", e_stream)
            from app.services.ollama_client import stream_llm
            async for chunk in stream_llm(
                question=question,
                protheus_data=protheus_data,
                intent=intent,
                context=context,
                history=history,
                image=image,
                allow_tools=False,
            ):
                yield chunk
