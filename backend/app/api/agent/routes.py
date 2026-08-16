from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from app.services.tenant_resolver import get_effective_config

router = APIRouter(prefix="/api/agent", tags=["agent"])

class AskPayload(BaseModel):
    query: str
    tenant_id: str
    company_id: str | None = None
    context: dict | None = None

@router.options("/ask/v2")
async def ask_options():
    return {"ok": True}

@router.post("/ask/v2")
async def ask_v2(payload: AskPayload, request: Request):
    cfg = get_effective_config(payload.tenant_id, payload.company_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Tenant inativo ou não encontrado")
    return {
        "ok": True,
        "tenant_id": payload.tenant_id,
        "company_id": payload.company_id,
        "schema_name": cfg["schema_name"],
        "message": "Processamento iniciado",
        "context": payload.context or {},
    }

@router.post("/ask/v2/upload")
async def ask_v2_upload(
    tenant_id: str = Form(...),
    company_id: str | None = Form(None),
    query: str = Form(...),
    file: UploadFile = File(...),
):
    cfg = get_effective_config(tenant_id, company_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Tenant inativo ou não encontrado")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    return {
        "ok": True,
        "tenant_id": tenant_id,
        "company_id": company_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "message": "Arquivo recebido para análise",
    }
