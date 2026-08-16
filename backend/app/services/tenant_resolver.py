from sqlalchemy import text
from app.db.database import SessionLocal

def get_effective_config(tenant_id, company_id=None):
    db = SessionLocal()
    try:
        tenant = db.execute(text("""
            SELECT id, tenant_code, schema_name, frontend_domain, api_domain, status
            FROM public.tenant
            WHERE tenant_code = :tenant_id
              AND status = 'active'
        """), {"tenant_id": tenant_id}).mappings().first()
        
        if not tenant:
            return None
            
        schema_name = tenant["schema_name"]
        company = None
        
        if company_id:
            company = db.execute(text(f"""
                SELECT *
                FROM "{schema_name}".company_info
                WHERE id = :company_id
                  AND status = 'active'
                LIMIT 1
            """), {"company_id": int(company_id)}).mappings().first()
        else:
            company = db.execute(text(f"""
                SELECT *
                FROM "{schema_name}".company_info
                WHERE status = 'active'
                ORDER BY default_flag DESC, updated_at DESC NULLS LAST
                LIMIT 1
            """)).mappings().first()
            
        effective = company or tenant
        return {
            "tenant": dict(tenant),
            "company": dict(company) if company else None,
            "schema_name": schema_name,
            "effective_frontend_domain": effective.get("frontend_domain") if effective else None,
            "effective_api_domain": effective.get("api_domain") if effective else None,
        }
    finally:
        db.close()

import re
from fastapi import HTTPException

_TENANT_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")
_BLOCKED_TENANTS = {"public", "pg_catalog", "information_schema", "root", "admin"}

def resolve_clean_tenant(raw_tenant_id: str | None) -> str:
    """
    Valida e normaliza tenant_id.
    Levanta HTTPException 400/403 em caso de valor inválido ou reservado.
    """
    if not raw_tenant_id or not str(raw_tenant_id).strip():
        return "default"

    clean = str(raw_tenant_id).strip().lower()

    if not _TENANT_PATTERN.match(clean):
        raise HTTPException(
            status_code=400,
            detail="tenant_id inválido. Use apenas letras, números, hífen, underscore."
        )

    if clean in _BLOCKED_TENANTS:
        raise HTTPException(
            status_code=403, 
            detail=f"tenant_id reservado: {clean}"
        )

    return clean
