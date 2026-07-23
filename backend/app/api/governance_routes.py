from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from app.db.database import get_db
from app.services.dictionary_service import DictionaryService

router = APIRouter(tags=["dictionary-admin"])

class SyncStartRequest(BaseModel):
    tenant_id: str
    company_id: Optional[str] = None
    env_id: Optional[str] = None
    modules: Optional[list[str]] = None
    snapshot_code: Optional[str] = None
    requested_by: Optional[str] = None

class PermitRequest(BaseModel):
    contract_id: str
    allowed_tables: list[dict]
    allowed_fields: list[dict]

@router.post("/admin/sync/dictionary/start")
async def start_sync_dictionary(req: SyncStartRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        service = DictionaryService(db)
        
        # Gera o snapshot_code inicial para retornar ao request logo de cara
        from datetime import datetime, timezone
        snap_code = req.snapshot_code or f"SYNC_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        
        snapshot = service.init_snapshot(
            tenant_id=req.tenant_id,
            company_id=req.company_id,
            env_id=req.env_id,
            user_id=req.requested_by,
            snapshot_code=snap_code
        )
        
        # Envia para background (na V5 passamos a rodar no celery/background)
        # Atenção: Passar a sessão do DB para a thread background precisa de cautela com Sessions, 
        # mas por simplicidade no MVP usamos o sync wrapper no DictionaryService.
        background_tasks.add_task(
            service.run_sync_task, 
            snapshot_id=snapshot.id,
            tenant_id=req.tenant_id,
            modules=req.modules
        )
        
        return {
            "snapshot_id": str(snapshot.id), 
            "snapshot_code": snapshot.snapshot_code, 
            "status": "accepted",
            "started_at": snapshot.started_at
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar sincronização: {str(e)}")

@router.get("/admin/sync/dictionary/status/{snapshot_code}")
def get_sync_status(snapshot_code: str, db: Session = Depends(get_db)):
    from app.models.knowledge import DictionarySnapshot
    snap = db.query(DictionarySnapshot).filter(DictionarySnapshot.snapshot_code == snapshot_code).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot não encontrado")
    return {
        "snapshot_code": snap.snapshot_code,
        "status": snap.sync_status,
        "total_tables": snap.total_tables,
        "total_fields": snap.total_fields,
        "total_indexes": snap.total_indexes,
        "finished_at": snap.finished_at,
        "notes": snap.notes
    }

@router.get("/admin/dictionary/{tenant_id}/snapshots")
def list_snapshots(tenant_id: str, db: Session = Depends(get_db)):
    from app.models.knowledge import DictionarySnapshot
    try:
        tid = uuid.UUID(tenant_id)
        snaps = db.query(DictionarySnapshot).filter(DictionarySnapshot.tenant_id == tid).order_by(DictionarySnapshot.started_at.desc()).all()
        return {"items": [{"id": str(s.id), "code": s.snapshot_code, "status": s.sync_status, "tables": s.total_tables, "started_at": s.started_at} for s in snaps]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/admin/dictionary/{snapshot_id}/tables")
def list_snapshot_tables(snapshot_id: str, db: Session = Depends(get_db)):
    from app.models.knowledge import TenantDictionaryTable
    try:
        sid = uuid.UUID(snapshot_id)
        tables = db.query(TenantDictionaryTable).filter(TenantDictionaryTable.snapshot_id == sid).all()
        return {"items": [{"id": str(t.id), "physical_name": t.physical_name, "table_name": t.table_name, "table_key": t.table_key} for t in tables]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/admin/dictionary/{table_id}/fields")
def list_snapshot_fields(table_id: str, db: Session = Depends(get_db)):
    from app.models.knowledge import TenantDictionaryField
    try:
        tid = uuid.UUID(table_id)
        fields = db.query(TenantDictionaryField).filter(TenantDictionaryField.table_id == tid).all()
        return {"items": [{"id": str(f.id), "field_name": f.field_name, "description": f.field_description, "type": f.field_type} for f in fields]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/dictionary/{snapshot_id}/permit")
def permit_snapshot(snapshot_id: str, req: PermitRequest, db: Session = Depends(get_db)):
    from app.models.knowledge import V4TenantAllowedTable, V4TenantAllowedField
    try:
        sid = uuid.UUID(snapshot_id)
        cid = uuid.UUID(req.contract_id)
        
        # Process tables
        for t in req.allowed_tables:
            table_id = uuid.UUID(t["table_id"])
            existing_table = db.query(V4TenantAllowedTable).filter(
                V4TenantAllowedTable.snapshot_id == sid,
                V4TenantAllowedTable.table_id == table_id
            ).first()
            if existing_table:
                existing_table.allowed = True
                existing_table.access_level = t.get("access_level", "query")
                existing_table.rationale = t.get("rationale", "")
            else:
                db.add(V4TenantAllowedTable(
                    snapshot_id=sid,
                    table_id=table_id,
                    contract_id=cid,
                    tenant_id=None, # Idealmente pegaria da tabela
                    allowed=True,
                    access_level=t.get("access_level", "query"),
                    rationale=t.get("rationale", "")
                ))
        
        # Process fields
        for f in req.allowed_fields:
            field_id = uuid.UUID(f["field_id"])
            table_id = uuid.UUID(f["table_id"])
            existing_field = db.query(V4TenantAllowedField).filter(
                V4TenantAllowedField.field_id == field_id
            ).first()
            if existing_field:
                existing_field.allowed = f.get("allowed", True)
                existing_field.masking_required = f.get("masking_required", False)
            else:
                db.add(V4TenantAllowedField(
                    table_id=table_id,
                    field_id=field_id,
                    allowed=f.get("allowed", True),
                    masking_required=f.get("masking_required", False)
                ))
                
        db.commit()
        return {"status": "success", "message": f"{len(req.allowed_tables)} tables and {len(req.allowed_fields)} fields permitted."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
