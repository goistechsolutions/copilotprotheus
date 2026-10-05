from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException

def get_company_or_404(db: Session, company_id) -> dict:
    cid_str = str(company_id).strip()
    reg = db.execute(
        text("""
            SELECT id, tenant_code, tenant_name, schema_name, status
            FROM public.tenants
            WHERE id::text = :cid OR tenant_code = :cid OR schema_name = :cid
            LIMIT 1
        """),
        {"cid": cid_str}
    ).mappings().first()
    
    if not reg:
        raise HTTPException(status_code=404, detail="Empresa/Tenant não encontrado")
    
    return dict(reg)
