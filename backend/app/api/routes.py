from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.assistant import AskRequest, AskResponse
from app.core.context import parse_context
from app.services.assistant_service import AssistantService
from app.core.auth import get_current_user
from urllib.parse import urlencode
import os
import html
from urllib.parse import urlencode

router = APIRouter(prefix="/api")

@router.post("/ask", response_model=AskResponse)
async def ask(
    request: Request,
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    ctx = parse_context(request, payload)
    
    # Garante que o tenant_id venha estritamente do token JWT assinado, impedindo bypass
    if current_user and "tenant_id" in current_user:
        ctx["tenant_id"] = current_user["tenant_id"]
        
    # Validar licença da empresa se cadastrada
    from app.models.knowledge import Company
    from app.services.license_service import verify_license
    tenant_id = ctx.get("tenant_id", "default")
    company = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
    if company:
        try:
            verify_license(company.licenca_uso, expected_cnpj=company.cnpj)
        except Exception as e:
            return AskResponse(
                text=f"**Acesso Bloqueado** — A licença de uso para a empresa **{company.razao_social}** está expirada ou é inválida.\n\nPor favor, atualize a licença nas configurações do Copilot ou contate o suporte da Elitecorp.",
                sql_used=""
            )
        
    return await AssistantService(db).answer_question(payload, ctx)

from fastapi.responses import StreamingResponse
import json

@router.post("/ask/stream")
async def ask_stream(
    request: Request,
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    ctx = parse_context(request, payload)
    if current_user and "tenant_id" in current_user:
        ctx["tenant_id"] = current_user["tenant_id"]
        
    # Validar licença antes de iniciar o generator do stream
    from app.models.knowledge import Company
    from app.services.license_service import verify_license
    tenant_id = ctx.get("tenant_id", "default")
    company = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
    
    blocked_message = None
    if company:
        try:
            verify_license(company.licenca_uso, expected_cnpj=company.cnpj)
        except Exception as e:
            blocked_message = f"**Acesso Bloqueado** — A licença de uso para a empresa **{company.razao_social}** está expirada ou é inválida.\n\nPor favor, atualize a licença nas configurações do Copilot ou contate o suporte da Elitecorp."
        
    async def event_generator():
        if blocked_message:
            yield f"data: {json.dumps({'token': blocked_message})}\n\n"
            yield "data: [DONE]\n\n"
            return
            
        try:
            service = AssistantService(db)
            async for token in service.answer_question_stream(payload, ctx):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/launch")
def launch(request: Request):
    params = dict(request.query_params)
    if not params:
        params = {
            'environment': os.getenv('PROTHEUS_ENVIRONMENT', 'validacao'),
            'company': os.getenv('PROTHEUS_COMPANY', '01'),
            'branch': os.getenv('PROTHEUS_BRANCH', '0101'),
            'module': os.getenv('PROTHEUS_MODULE', 'SIGAFAT'),
            'user': os.getenv('PROTHEUS_USER', 'admin'),
            'station': os.getenv('PROTHEUS_STATION', 'WEB01'),
            'session_id': os.getenv('PROTHEUS_SESSION_ID', 'protheus-web-001'),
            'tenant_id': 'pilot_rodolltda'
        }
    
    # Resolve a URL do WebClient/WebApp do Protheus dinamicamente do banco de dados (SaaS)
    from app.db.database import SessionLocal
    from app.models.knowledge import Company
    
    tenant_id = params.get('tenant_id', 'pilot_rodolltda')
    launch_url = None
    
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
        if company and company.protheus_webapp_url:
            launch_url = company.protheus_webapp_url
    except Exception as e:
        pass
    finally:
        db.close()
        
    if not launch_url:
        launch_url = os.getenv('PROTHEUS_URL', 'https://rodolltda195384.protheus.cloudtotvs.com.br:10703/webapp/index.html')
    from fastapi.responses import RedirectResponse
    qs = urlencode(params)
    target_url = f"{launch_url}?{qs}"
    return RedirectResponse(url=target_url)

from app.schemas.company import SessionValidateRequest
from app.services.license_service import verify_license
from fastapi import HTTPException

@router.post("/auth/validate-session")
def validate_session(payload: SessionValidateRequest, db: Session = Depends(get_db)):
    from app.models.knowledge import Company
    # 1. Procurar empresa/grupo
    company = db.query(Company).filter(Company.protheus_grupo == payload.tenant_id).first()
    if not company:
        raise HTTPException(
            status_code=403, 
            detail=f"Grupo/Tenant '{payload.tenant_id}' nao cadastrado no Copilot Protheus."
        )
        
    # 2. Validar licença
    try:
        verify_license(company.licenca_uso, expected_cnpj=company.cnpj)
    except Exception as e:
        raise HTTPException(
            status_code=403,
            detail=f"Licenca expirada ou invalida para a empresa {company.razao_social}. Detalhe: {str(e)}"
        )
        
    # 3. Validar usuário se houver filtro
    if company.protheus_usuario:
        allowed = [u.strip().lower() for u in company.protheus_usuario.split(",") if u.strip()]
        if allowed and payload.user.lower() not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Usuario '{payload.user}' nao esta autorizado a acessar o Copilot para esta empresa."
            )
            
    return {"success": True, "razao_social": company.razao_social}
