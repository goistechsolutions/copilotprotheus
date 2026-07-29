"""
deps.py
Dependency do FastAPI que resolve o tenant autenticado e injeta a sessão correta.
"""
from fastapi import Depends, HTTPException, status
from db_session import get_tenant_session
from tenant_provisioning import resolve_schema_for_tenant, TenantProvisioningError
from auth import get_current_user  # já existente no projeto


async def get_current_tenant_db(current_user=Depends(get_current_user)):
    try:
        schema_name = await resolve_schema_for_tenant(current_user.db_public, current_user.tenant_code)
    except TenantProvisioningError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    async with get_tenant_session(schema_name) as session:
        yield session
