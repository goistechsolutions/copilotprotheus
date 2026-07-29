from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import (
    TenantAllowedTable,
    TenantDictionaryTable,
    DictionarySnapshot,
    TenantContract,
    Company,
    Tenant,
)
from typing import List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/governance", tags=["governance"])


class AllowTableRequest(BaseModel):
    tenant_id: str
    contract_id: str
    snapshot_id: str
    table_id: str
    access_level: Optional[str] = "query"
    allowed: Optional[bool] = True
    rationale: Optional[str] = None


class AllowTableResponse(BaseModel):
    id: str
    tenant_id: str
    contract_id: str
    snapshot_id: str
    table_id: str
    access_level: str
    allowed: bool
    rationale: Optional[str]

    class Config:
        from_attributes = True


@router.get("/allowed-tables")
def list_allowed_tables(
    tenant_id: Optional[str] = None,
    snapshot_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista tabelas permitidas para o tenant/snapshot."""
    if tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    q = db.query(TenantAllowedTable)
    if tenant_id:
        q = q.filter(TenantAllowedTable.tenant_id == tenant_id)
    if snapshot_id:
        try:
            sid = uuid.UUID(snapshot_id)
            q = q.filter(TenantAllowedTable.snapshot_id == sid)
        except ValueError:
            raise HTTPException(status_code=400, detail="snapshot_id inválido")
    return q.order_by(TenantAllowedTable.created_at.desc()).all()


@router.post("/allowed-tables", status_code=201)
def allow_table(
    payload: AllowTableRequest,
    db: Session = Depends(get_db)
):
    """Permite ou bloqueia acesso a uma tabela do dicionário para o tenant."""
    if payload.tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(payload.tenant_id))
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    try:
        entry = TenantAllowedTable(
            tenant_id=payload.tenant_id,
            contract_id=uuid.UUID(payload.contract_id),
            snapshot_id=uuid.UUID(payload.snapshot_id),
            table_id=uuid.UUID(payload.table_id),
            access_level=payload.access_level or "query",
            allowed=payload.allowed if payload.allowed is not None else True,
            rationale=payload.rationale,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return {"id": str(entry.id), "allowed": entry.allowed, "access_level": entry.access_level}
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
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    q = db.query(TenantDictionaryTable)
    if tenant_id:
        q = q.filter(TenantDictionaryTable.tenant_id == tenant_id)
    if snapshot_id:
        try:
            sid = uuid.UUID(snapshot_id)
            q = q.filter(TenantDictionaryTable.snapshot_id == sid)
        except ValueError:
            raise HTTPException(status_code=400, detail="snapshot_id inválido")
    if module_code:
        q = q.filter(TenantDictionaryTable.module_code == module_code.upper())
    return q.order_by(TenantDictionaryTable.physical_name.asc()).limit(200).all()


@router.get("/snapshots")
def list_snapshots(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista snapshots de dicionário disponíveis."""
    if tenant_id:
        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
        if clean_tenant and clean_tenant != "public":
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    q = db.query(DictionarySnapshot)
    if tenant_id:
        q = q.filter(DictionarySnapshot.tenant_id == tenant_id)
    return q.order_by(DictionarySnapshot.started_at.desc()).limit(50).all()
