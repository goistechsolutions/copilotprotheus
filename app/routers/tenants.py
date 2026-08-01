"""Endpoints de tenants (empresas)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TenantRegistry
from app.db.session import get_db
from app.routers.auth import get_current_user
from app.schemas.tenants import TenantOut

router = APIRouter()


@router.get("/", response_model=list[TenantOut], summary="Listar tenants")
async def list_tenants(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    result = await db.execute(
        select(TenantRegistry).order_by(TenantRegistry.tenant_name)
    )
    return result.scalars().all()


@router.get("/{tenant_id}", response_model=TenantOut, summary="Detalhe do tenant")
async def get_tenant(
    tenant_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TenantRegistry).where(TenantRegistry.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant não encontrado",
        )
    return tenant
