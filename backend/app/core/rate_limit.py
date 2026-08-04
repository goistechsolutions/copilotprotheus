import logging
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import resolve_clean_tenant

logger = logging.getLogger("app.core.rate_limit")

def check_tenant_rate_limit(db: Session, tenant_id: str) -> dict:
    """
    Verifica se o tenant excedeu a cota diária de consultas estipulada no seu plano (public.plans).
    Lança HTTPException 429 se o limite diário tiver sido atingido.
    """
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    
    max_queries_day = 500  # Valor padrão de resiliência
    
    # 1. Busca o plano e limite diário do tenant em public.tenant_registry e public.plans
    try:
        query_plan = text("""
            SELECT p.max_queries_day
            FROM public.tenant_registry tr
            LEFT JOIN public.plans p ON tr.plan_code = p.plan_code
            WHERE tr.tenant_code = :clean_tenant OR tr.schema_name = :clean_tenant
            LIMIT 1
        """)
        res = db.execute(query_plan, {"clean_tenant": clean_tenant}).fetchone()
        if res and res[0] is not None:
            max_queries_day = int(res[0])
    except Exception as e:
        logger.warning(f"[RateLimit] Falha ao consultar plano do tenant {clean_tenant}: {e}")

    # 2. Contabiliza quantas consultas foram efetuadas no dia de hoje
    today_count = 0
    try:
        query_usage = text("""
            SELECT COUNT(*)
            FROM public.platform_audit_log
            WHERE (tenant_code = :clean_tenant OR tenant_code = :tenant_id)
              AND action IN ('sql_query', 'query_execution', 'agent_query')
              AND created_at >= CURRENT_DATE
        """)
        count_res = db.execute(query_usage, {"clean_tenant": clean_tenant, "tenant_id": tenant_id}).scalar()
        if count_res is not None:
            today_count = int(count_res)
    except Exception as e_audit:
        logger.warning(f"[RateLimit] Falha ao consultar histórico de uso para {clean_tenant}: {e_audit}")

    # 3. Valida se o limite diário foi atingido
    if today_count >= max_queries_day:
        logger.warning(f"[RateLimit] Bloqueio HTTP 429 ativado para {clean_tenant}: {today_count}/{max_queries_day} hoje.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Limite diário de consultas atingido para o tenant '{clean_tenant}' ({today_count}/{max_queries_day} consultas/dia). Entre em contato com o administrador para upgrade de plano."
        )

    return {
        "tenant": clean_tenant,
        "queries_today": today_count,
        "max_queries_day": max_queries_day,
        "remaining": max_queries_day - today_count
    }
