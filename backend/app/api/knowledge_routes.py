from fastapi import APIRouter, Depends, Header, UploadFile, File
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.crud.knowledge_crud import KnowledgeCRUD
from app.services.ingestion_service import IngestionService
from app.services.rag_service import RAGService

router = APIRouter(prefix='/knowledge', tags=['knowledge'])

@router.post('/ingest')
def ingest(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id)

@router.post('/upload')
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    # Corrigido para caminho relativo que funciona no Docker (Hetzner) e Local
    docs_dir = Path("./docs")
    docs_dir.mkdir(parents=True, exist_ok=True)
    file_path = docs_dir / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id)

@router.get('/documents')
def documents(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_documents(tenant_id=x_tenant_id)}

@router.post('/documents')
def create_document(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    return crud.add_document(payload)

@router.get('/memories')
def memories(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_memories(tenant_id=x_tenant_id)}

@router.post('/memories')
def create_memory(payload: dict, db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
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
