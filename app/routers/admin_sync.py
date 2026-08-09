"""
app/routers/admin_sync.py

Rota administrativa para sincronização do dicionário por tenant.
Valida tenant com resolve_clean_tenant e usa sync_dictionary_service.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from app.db.database import get_db
from app.services.tenant_resolver import resolve_clean_tenant
from app.services.sync_dictionary_service import sync_selected_modules

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

class SyncPayload(BaseModel):
    environment_id: str
    snapshot_code: str
    modules: list[str]

@router.post("/tenants/{tenant_id}/dictionary/sync")
def sync_dictionary(tenant_id: str, payload: SyncPayload, db: Session = Depends(get_db)):
    """
    Body (SyncPayload):
    {
      "environment_id": "producao",
      "snapshot_code": "sx2-20260801",
      "modules": ["SIGAEST","SIGACOM"]
    }
    """
    # Resolve e valida tenant -> retorna schema name ou slug conforme implementacao
    tenant_schema = resolve_clean_tenant(tenant_id)

    # Valida payload
    if not payload.modules or len(payload.modules) == 0:
        raise HTTPException(status_code=400, detail="Selecione ao menos um módulo para sincronizar.")

    logger.info("sync_dictionary requested; tenant=%s modules=%s snapshot=%s",
                tenant_schema, payload.modules, payload.snapshot_code)

    rows = sync_selected_modules(
        db=db,
        tenant_schema=tenant_schema,
        selected_modules=payload.modules,
    )

    # Converte rows para dicionários simples para resposta JSON
    items = []
    for r in rows:
        # SQLAlchemy Row -> mapping
        try:
            mapping = dict(r._mapping)
        except AttributeError:
            # compatibilidade: row pode ser tupla -> mapear manualmente (fallback)
            # Mas preferimos erro explícito: peça para ajustar se necessário
            raise HTTPException(status_code=500, detail="Formato inesperado do resultado do banco.")
        items.append(mapping)

    return {"success": True, "total": len(items), "items": items}
