import re

with open('backend/app/services/assistant_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'if str(backend_used).lower() in ("ollama", "local"):',
    'if str(backend_used).lower() == "openai":\n            from app.services.openai_client import ask_openai\n            try:\n                answer = await asyncio.wait_for(\n                    ask_openai(\n                        question=question,\n                        protheus_data=protheus_data if protheus_data else None,\n                        intent=intent,\n                        context=context,\n                        history=history\n                    ),\n                    timeout=settings.timeout_seconds\n                )\n            except asyncio.TimeoutError:\n                answer = "A IA Local excedeu o tempo limite."\n                status_audit = "T"\n            except Exception as e:\n                logger.error("[Assistant] Falha no OpenAI local: %s", e)\n                answer = "Erro na IA Local OpenAI Compatible."\n                status_audit = "E"\n        elif str(backend_used).lower() in ("ollama", "local"):'
)

content = content.replace(
    'if target_backend == "ollama":',
    'if target_backend == "openai":\n            from app.services.openai_client import stream_openai\n            try:\n                async for token in stream_openai(\n                    question=question,\n                    protheus_data=protheus_data if protheus_data else None,\n                    intent=intent,\n                    context=context,\n                    history=history\n                ):\n                    full_answer.append(token)\n                    yield token\n            except Exception as e:\n                logger.error("[Assistant Stream] Erro no stream OpenAI: %s", e)\n                error_message = "Erro ao se conectar na IA local via OpenAI Compatible API."\n                full_answer.append(error_message)\n                yield error_message\n        elif target_backend == "ollama":'
)

with open('backend/app/services/assistant_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

