# backend/audit_service.py  -- PostgreSQL via asyncpg
import os
import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/copilot_protheus")
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool

async def audit_log(user, session_id, module, company, branch,
                    environment, question, answer, intent,
                    response_time_ms, records_returned, status="S"):
    sql = (
        "INSERT INTO audit_logs "
        "(user_name, session_id, module, company, branch, "
        "environment, question, answer, intent, "
        "response_time_ms, records_returned, status, created_at) "
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())"
    )
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                sql,
                user, session_id, module, company, branch,
                environment, question, answer, intent,
                response_time_ms, records_returned, status
            )
    except Exception as e:
        print(f"[audit_log] Falha: {e}")
