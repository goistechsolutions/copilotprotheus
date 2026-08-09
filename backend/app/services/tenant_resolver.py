"""
Validação e normalização de tenant_id.
Uso obrigatório antes de qualquer query/upsert que envolva tenant_id.
"""
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
