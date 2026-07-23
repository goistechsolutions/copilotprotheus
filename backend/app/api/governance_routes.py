from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from app.db.database import get_db
from app.services.dictionary_service import DictionaryService

router = APIRouter(prefix="/governance", tags=["governance"])

class SyncRequest(BaseModel):
    tenant_id: str
    company_id: Optional[str] = None
    env_id: Optional[str] = None
    user_id: Optional[str] = None

@router.post("/snapshots/sync")
async def sync_dictionary(req: SyncRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Dispara a sincronização do dicionário Protheus. 
    Para evitar timeouts no cliente (já que carregar SX2, SX3 e SIX pode demorar), 
    o processamento pesado será executado em background.
    """
    try:
        service = DictionaryService(db)
        # Idealmente, passamos o serviço para o background_tasks. 
        # Cuidado com escopos de banco de dados se for muito demorado. 
        # Aqui, como é um MVP de FastAPI background task, a Session precisaria ser gerenciada dentro da task, 
        # mas por simplicidade de implementação V4, vamos rodar com await mesmo para testar.
        # Caso precise, em produção, use background_tasks.add_task(...) 
        snapshot = await service.sync_dictionary(
            tenant_id=req.tenant_id,
            company_id=req.company_id,
            env_id=req.env_id,
            user_id=req.user_id
        )
        return {"message": "Sincronização concluída com sucesso.", "snapshot_code": snapshot.snapshot_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar dicionário: {str(e)}")

@router.get("/snapshots")
def list_snapshots(tenant_id: str, db: Session = Depends(get_db)):
    from app.models.knowledge import DictionarySnapshot
    try:
        tid = uuid.UUID(tenant_id)
        snaps = db.query(DictionarySnapshot).filter(DictionarySnapshot.tenant_id == tid).order_by(DictionarySnapshot.started_at.desc()).all()
        return {"items": [{"id": str(s.id), "code": s.snapshot_code, "status": s.sync_status, "tables": s.total_tables} for s in snaps]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
