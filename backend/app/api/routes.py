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
        
    # Keras / JAX Intent Routing (Cognitive Firewall)
    try:
        from app.services.intent_service import IntentService
        intent = IntentService().predict_intent(payload.question)
        if intent == "GREETING":
            return AskResponse(
                answer="Olá! Sou o CopilotProtheus. Como posso ajudar com os dados do seu ERP hoje?",
                intent="GREETING",
                backend="keras_local"
            )
        elif intent == "OFF_TOPIC":
            return AskResponse(
                answer="**Bloqueado:** Desculpe, mas eu respondo apenas a questões relacionadas ao sistema Protheus e análises de dados empresariais.",
                intent="OFF_TOPIC",
                backend="keras_local"
            )
    except Exception as e:
        pass # Fallback silencioso para o LLM real se o Keras falhar

    answer_dict = await AssistantService(db).answer_question(payload, ctx)
    answer_text = answer_dict.get("answer", "")
    
    # Extrair JSON de dashboard se o LLM tiver formatado como JSON
    dashboard_data = {}
    try:
        import json
        import re
        json_match = re.search(r'```(?:json)?\n(.*?)\n```', answer_text, re.DOTALL)
        if json_match:
            clean_ans = json_match.group(1).strip()
        else:
            clean_ans = answer_text.strip()
            
        if clean_ans.startswith('{') and clean_ans.endswith('}'):
            parsed = json.loads(clean_ans)
            if "datasets" in parsed:
                dashboard_data = parsed
    except Exception:
        pass

    return AskResponse(
        answer=dashboard_data.get("answer", answer_text),
        intent=answer_dict.get("intent"),
        backend=answer_dict.get("backend"),
        datasets=dashboard_data.get("datasets"),
        labels=dashboard_data.get("labels"),
        tipo_grafico=dashboard_data.get("tipo_grafico"),
        titulo=dashboard_data.get("titulo"),
        insights=dashboard_data.get("insights")
    )

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
            # Keras / JAX Intent Routing (Cognitive Firewall) para o Stream
            from app.services.intent_service import IntentService
            intent = IntentService().predict_intent(payload.question)
            
            if intent == "GREETING":
                yield f"data: {json.dumps({'token': 'Olá! Sou o CopilotProtheus. Como posso ajudar com os dados do seu ERP hoje?'})}\n\n"
                yield "data: [DONE]\n\n"
                return
            elif intent == "OFF_TOPIC":
                yield f"data: {json.dumps({'token': '**Bloqueado:** Desculpe, mas eu respondo apenas a questões relacionadas ao sistema Protheus e análises de dados empresariais.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
                
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
    tenant_id = params.get('tenant_id', 'pilot_rodolltda')
    
    # Resolve a URL do WebClient/WebApp do Protheus dinamicamente do banco de dados (SaaS)
    from app.db.database import SessionLocal
    from app.models.knowledge import Company
    
    launch_url = None
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
        if company and company.protheus_webapp_url:
            launch_url = company.protheus_webapp_url
            
            # Use company data for defaults if not provided in params
            if not params.get('environment') and company.protheus_ambientes:
                params['environment'] = company.protheus_ambientes.split(',')[0].strip()
            if not params.get('company') and company.protheus_empresa:
                params['company'] = company.protheus_empresa
            if not params.get('branch') and company.protheus_filial:
                params['branch'] = company.protheus_filial
            if not params.get('user'):
                params['user'] = company.protheus_usuario.split(',')[0].strip() if company.protheus_usuario else 'admin'
    except Exception as e:
        pass
    finally:
        db.close()
        
    if not launch_url:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"URL do WebApp não configurada para o tenant {tenant_id}")
        
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
