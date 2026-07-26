# backend/assistant_service.py — trecho com auditoria ativada
import time
from audit_service import audit_log

async def ask(payload: dict) -> dict:
    start = time.time()
    intent    = payload.get("intent", "geral")
    question  = payload.get("question", "")
    context   = payload.get("context", {})
    status    = "S"
    answer    = ""
    records   = 0

    try:
        # ... lógica existente de geração de resposta ...
        answer  = await generate_answer(payload)
        records = len(payload.get("protheusData", {}).get("pedidos", []) or [])
    except Exception as e:
        answer = f"Erro ao processar: {str(e)}"
        status = "E"
    finally:
        elapsed_ms = int((time.time() - start) * 1000)
        await audit_log(
            user             = context.get("user", "desconhecido"),
            session_id       = context.get("session_id", ""),
            module           = context.get("module", ""),
            company          = context.get("company", ""),
            branch           = context.get("branch", ""),
            environment      = context.get("environment", ""),
            question         = question,
            answer           = answer,
            intent           = intent,
            response_time_ms = elapsed_ms,
            records_returned = records,
            status           = status,
        )

    return {"answer": answer}
