from fastapi import APIRouter, Depends, Header, UploadFile, File, Query, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.crud.knowledge_crud import KnowledgeCRUD
from app.services.ingestion_service import IngestionService, SHARED_DOCS_DIR, TENANTS_DOCS_DIR
from app.services.rag_service import RAGService

router = APIRouter(prefix='/knowledge', tags=['knowledge'])
security = HTTPBasic()

def verify_admin_if_shared(visibility: str, credentials: HTTPBasicCredentials = Depends(security)):
    if visibility == 'shared':
        if not credentials or credentials.username != 'admin' or credentials.password != 'admin123':
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Acesso negado para modificar recursos compartilhados",
                headers={"WWW-Authenticate": "Basic"},
            )
    return True

@router.post('/ingest')
def ingest(
    db: Session = Depends(get_db),
    x_tenant_id: str = Header("default"),
    visibility: str = Query("tenant", description="'shared' para documentos globais, 'tenant' para exclusivos"),
    is_admin: bool = Depends(verify_admin_if_shared)
):
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id, visibility=visibility)

@router.post('/upload')
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    x_tenant_id: str = Header("default"),
    visibility: str = Query("tenant", description="'shared' para documentos globais, 'tenant' para exclusivos"),
    is_admin: bool = Depends(verify_admin_if_shared)
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
def create_document(
    payload: dict, 
    db: Session = Depends(get_db), 
    x_tenant_id: str = Header("default"),
    credentials: HTTPBasicCredentials = Depends(security)
):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    if "visibility" not in payload:
        payload["visibility"] = "tenant"
    verify_admin_if_shared(payload["visibility"], credentials)
    return crud.add_document(payload)

@router.delete('/documents/{document_id}')
def delete_document(
    document_id: int, 
    db: Session = Depends(get_db), 
    x_tenant_id: str = Header("default"),
    credentials: HTTPBasicCredentials = Depends(security)
):
    crud = KnowledgeCRUD(db)
    # Tenta descobrir a visibilidade para validar
    from sqlalchemy import text
    q = text("SELECT visibility FROM documents WHERE id = :id")
    doc = db.execute(q, {"id": document_id}).mappings().first()
    if doc:
        verify_admin_if_shared(doc["visibility"], credentials)
    
    deleted = crud.delete_document(document_id, x_tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Documento não encontrado ou sem permissão")
    return {"message": "Documento excluído com sucesso", "id": document_id}

@router.get('/memories')
def memories(db: Session = Depends(get_db), x_tenant_id: str = Header("default")):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_memories(tenant_id=x_tenant_id)}

@router.post('/memories')
def create_memory(
    payload: dict, 
    db: Session = Depends(get_db), 
    x_tenant_id: str = Header("default"),
    credentials: HTTPBasicCredentials = Depends(security)
):
    crud = KnowledgeCRUD(db)
    payload["tenant_id"] = x_tenant_id
    if "visibility" not in payload:
        payload["visibility"] = "tenant"
    verify_admin_if_shared(payload["visibility"], credentials)
    return crud.add_memory(payload)

@router.delete('/memories/{memory_id}')
def delete_memory(
    memory_id: int, 
    db: Session = Depends(get_db), 
    x_tenant_id: str = Header("default"),
    credentials: HTTPBasicCredentials = Depends(security)
):
    crud = KnowledgeCRUD(db)
    from sqlalchemy import text
    q = text("SELECT visibility FROM memories WHERE id = :id")
    mem = db.execute(q, {"id": memory_id}).mappings().first()
    if mem:
        verify_admin_if_shared(mem["visibility"], credentials)
        
    deleted = crud.delete_memory(memory_id, x_tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memória não encontrada ou sem permissão")
    return {"message": "Memória excluída com sucesso", "id": memory_id}

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
