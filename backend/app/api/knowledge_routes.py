from fastapi import APIRouter, Depends, Header, UploadFile, File, Query
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.crud.knowledge_crud import KnowledgeCRUD
from app.services.ingestion_service import IngestionService, SHARED_DOCS_DIR, TENANTS_DOCS_DIR
from app.services.rag_service import RAGService

router = APIRouter(prefix='/knowledge', tags=['knowledge'])

@router.post('/ingest')
def ingest(
    db: Session = Depends(get_db),
    x_tenant_id: str = Header("default"),
    visibility: str = Query("tenant", description="'shared' para documentos globais, 'tenant' para exclusivos")
):
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id, visibility=visibility)

@router.post('/upload')
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    x_tenant_id: str = Header("default"),
    visibility: str = Query("tenant", description="'shared' para documentos globais, 'tenant' para exclusivos")
):
    # Salvar arquivo na subpasta correta do tenant (isolamento por empresa)
    if visibility == 'shared':
        docs_dir = SHARED_DOCS_DIR
    else:
        docs_dir = TENANTS_DOCS_DIR / x_tenant_id
    
    docs_dir.mkdir(parents=True, exist_ok=True)
    file_path = docs_dir / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id, visibility=visibility)

@router.get('/documents')
def documents(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_documents(tenant_id=x_tenant_id)}

@router.get('/documents/shared')
def shared_documents(db: Session = Depends(get_db)):
    """Lista apenas documentos compartilhados (base de conhecimento global)."""
    from sqlalchemy import text
    q = text("SELECT * FROM documents WHERE visibility = 'shared' ORDER BY created_at DESC LIMIT 200")
    rows = db.execute(q).mappings().all()
    return {'items': rows}

@router.post('/documents')
def create_document(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    if "visibility" not in payload:
        payload["visibility"] = "tenant"
    return crud.add_document(payload)

@router.get('/memories')
def memories(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_memories(tenant_id=x_tenant_id)}

@router.post('/memories')
def create_memory(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    if "visibility" not in payload:
        payload["visibility"] = "tenant"
    return crud.add_memory(payload)

@router.get('/audit')
def audit(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_audit(tenant_id=x_tenant_id)}

@router.post('/audit')
def create_audit(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    return crud.add_audit(payload)

@router.post('/search')
def search(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    rag = RAGService(db)
    return {'items': rag.search(payload.get('question', ''), tenant_id=x_tenant_id)}
