import re
from app.services.tenant_resolver import resolve_clean_tenant
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import (
    TenantAllowedTable,
    TenantDictionaryTable,
    TenantContract,
    Company,
    Tenant,
)
from app.models.catalog_v52 import DictionaryTable

from typing import List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/governance", tags=["governance"])


class AllowTableRequest(BaseModel):
    tenant_id: str
    table_name: str
    module_code: Optional[str] = None
    active: Optional[bool] = True


class AllowTableResponse(BaseModel):
    id: str
    tenant_id: str
    table_name: str
    module_code: Optional[str]
    active: bool

    class Config:
        from_attributes = True


@router.get("/allowed-tables")
def list_allowed_tables(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista tabelas permitidas para o tenant."""
    if tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables, resolve_clean_tenant
        clean_tenant = resolve_clean_tenant(tenant_id)
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    q = db.query(TenantAllowedTable)
    if tenant_id:
        q = q.filter(TenantAllowedTable.tenant_id == tenant_id)
    return q.order_by(TenantAllowedTable.created_at.desc()).all()


@router.post("/allowed-tables", status_code=201)
def allow_table(
    payload: AllowTableRequest,
    db: Session = Depends(get_db)
):
    """Permite ou bloqueia acesso a uma tabela do dicionario para o tenant."""
    if payload.tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables, resolve_clean_tenant
        clean_tenant = resolve_clean_tenant(payload.tenant_id)
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    try:
        entry = TenantAllowedTable(
            tenant_id=payload.tenant_id,
            table_name=payload.table_name,
            module_code=payload.module_code,
            active=payload.active if payload.active is not None else True,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return {"id": str(entry.id), "active": entry.active, "table_name": entry.table_name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao salvar permissão: {str(e)}")


@router.delete("/allowed-tables/{entry_id}")
def revoke_table_access(entry_id: str, db: Session = Depends(get_db)):
    """Remove permissão de acesso a uma tabela."""
    try:
        eid = uuid.UUID(entry_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="entry_id inválido")
    entry = db.query(TenantAllowedTable).filter(TenantAllowedTable.id == eid).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Permissão não encontrada")
    db.delete(entry)
    db.commit()
    return {"message": "Permissão revogada com sucesso"}


@router.get("/dictionary-tables")
def list_dictionary_tables(
    tenant_id: Optional[str] = None,
    snapshot_id: Optional[str] = None,
    module_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista tabelas do dicionário Protheus sincronizadas."""
    if tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        clean_tenant = resolve_clean_tenant(tenant_id)
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    q = db.query(DictionaryTable)
    if tenant_id:
        q = q.filter(DictionaryTable.tenant_id == tenant_id)
    if snapshot_id:
        try:
            sid = uuid.UUID(snapshot_id)
            q = q.filter(DictionaryTable.snapshot_id == sid)
        except ValueError:
            raise HTTPException(status_code=400, detail="snapshot_id inválido")
    if module_code:
        q = q.filter(DictionaryTable.module_code == module_code.upper())
    return q.order_by(DictionaryTable.physical_name.asc()).limit(200).all()
        q = q.filter(TenantDictionaryTable.module_code == module_code.upper())
    return q.order_by(TenantDictionaryTable.physical_name.asc()).limit(200).all()
