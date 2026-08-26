from pathlib import Path
import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin_security import require_admin
from app.crud.knowledge_crud import KnowledgeCRUD
from app.db.database import get_db
from app.services.ingestion_service import IngestionService
from app.services.r2_client import R2Client
from app.services.rag_service import RAGService

router = APIRouter(prefix='/knowledge', tags=['knowledge'])


def _tenant_header(x_tenant_id: str = Header(..., alias='X-Tenant-ID', min_length=1)) -> str:
    return x_tenant_id.strip()


def _safe_filename(filename: str | None) -> str:
    safe_name = Path(filename or '').name
    if not safe_name or safe_name in {'.', '..'}:
        raise HTTPException(status_code=400, detail='O arquivo enviado não possui um nome válido.')
    return safe_name


@router.post('/ingest')
def ingest(
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
    visibility: str = Query('tenant', pattern='^(shared|tenant)$'),
):
    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id.strip(), visibility=visibility)


@router.post('/upload')
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
    visibility: str = Query('tenant', pattern='^(shared|tenant)$'),
):
    object_name = f"{'shared' if visibility == 'shared' else f'tenants/{x_tenant_id.strip()}'}/{_safe_filename(file.filename)}"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)
        if not R2Client().upload_file(tmp_path, object_name):
            raise HTTPException(status_code=502, detail='Não foi possível enviar o arquivo para o armazenamento R2.')
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    service = IngestionService(db)
    return service.ingest(tenant_id=x_tenant_id.strip(), visibility=visibility)


@router.get('/documents')
def documents(
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    crud = KnowledgeCRUD(db)
    return {'items': crud.list_documents(tenant_id=x_tenant_id.strip())}


@router.get('/documents/shared')
def shared_documents(
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    rows = db.execute(text("SELECT * FROM documents WHERE visibility = 'shared' ORDER BY created_at DESC LIMIT 200")).mappings().all()
    return {'items': rows}


@router.post('/documents')
def create_document(
    payload: dict,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    payload['tenant_id'] = x_tenant_id.strip()
    payload.setdefault('visibility', 'tenant')
    if payload['visibility'] not in {'tenant', 'shared'}:
        raise HTTPException(status_code=400, detail='Visibilidade de documento inválida.')
    return KnowledgeCRUD(db).add_document(payload)


@router.delete('/documents/{document_id}')
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    tenant_id = x_tenant_id.strip()
    doc = db.execute(
        text("SELECT visibility, source_path FROM documents WHERE id = :id AND tenant_id = :tenant_id"),
        {'id': document_id, 'tenant_id': tenant_id},
    ).mappings().first()
    deleted = KnowledgeCRUD(db).delete_document(document_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail='Documento não encontrado para o tenant informado.')

    if doc and doc.get('source_path') and str(doc['source_path']).startswith('r2://'):
        R2Client().delete_file(str(doc['source_path']).replace('r2://', '', 1))
    return {'message': 'Documento excluído com sucesso', 'id': document_id}


@router.get('/memories')
def memories(
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    return {'items': KnowledgeCRUD(db).list_memories(tenant_id=x_tenant_id.strip())}


@router.post('/memories')
def create_memory(
    payload: dict,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    payload['tenant_id'] = x_tenant_id.strip()
    payload.setdefault('visibility', 'tenant')
    if payload['visibility'] not in {'tenant', 'shared'}:
        raise HTTPException(status_code=400, detail='Visibilidade de memória inválida.')
    return KnowledgeCRUD(db).add_memory(payload)


@router.delete('/memories/{memory_id}')
def delete_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    tenant_id = x_tenant_id.strip()
    deleted = KnowledgeCRUD(db).delete_memory(memory_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail='Memória não encontrada para o tenant informado.')
    return {'message': 'Memória excluída com sucesso', 'id': memory_id}


@router.get('/audit')
def audit(
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    return {'items': KnowledgeCRUD(db).list_audit(tenant_id=x_tenant_id.strip())}


@router.post('/audit')
def create_audit(
    payload: dict,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
    admin: dict = Depends(require_admin),
):
    payload['tenant_id'] = x_tenant_id.strip()
    return KnowledgeCRUD(db).add_audit(payload)


@router.post('/search')
def search(
    payload: dict,
    db: Session = Depends(get_db),
    x_tenant_id: str = Depends(_tenant_header),
):
    return {'items': RAGService(db).search(payload.get('question', ''), tenant_id=x_tenant_id.strip())}
