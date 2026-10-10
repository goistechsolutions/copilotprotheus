from fastapi import APIRouter, Depends, HTTPException
import logging
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import time
import json

from app.db.database import get_db
from app.services.agent_service import AgentValidator
from app.services.protheus_service import _execute_http_post_with_retry, get_tenant_config, build_protheus_headers
from app.models.knowledge import Tenant, AgentQueryAudit, QueryUsageCounter
from app.core.auth import require_current_user
from app.core.admin_security import require_admin, authorize_admin_access

logger = logging.getLogger("app.agent_routes")

# Todas as rotas exigem autenticação; /usage usa credencial administrativa (ver abaixo).
router = APIRouter(prefix="/agent", tags=["agent-execution"])


def _enforce_token_tenant(current_user: dict, requested_tenant: str) -> str:
    """O tenant efetivo vem do JWT; o enviado no corpo só pode coincidir com ele."""
    token_tenant = str(current_user.get("tenant_id") or current_user.get("tenantId") or "").strip()
    if not token_tenant:
        raise HTTPException(status_code=401, detail="JWT sem tenant_id.")
    if token_tenant.lower() != str(requested_tenant or "").strip().lower():
        raise HTTPException(status_code=403, detail="O tenant do JWT não corresponde ao tenant da requisição.")
    return token_tenant

class TableUsed(BaseModel):
    table_id: str
    snapshot_id: str

class FieldUsed(BaseModel):
    table_id: str
    field_id: str
    field_name: str

class ValidateQueryRequest(BaseModel):
    tenant_id: str
    environment_code: str
    contract_id: Optional[str] = None

    company_id: Optional[str] = None
    env_id: Optional[str] = None
    user_id: Optional[str] = None
    request_id: Optional[str] = None
    tables_used: List[TableUsed] = []
    fields_used: List[FieldUsed] = []
    sql_preview: str

class ExecuteQueryRequest(ValidateQueryRequest):
    final_sql: str

@router.post("/validate-query")
def validate_query(
    req: ValidateQueryRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_current_user),
):
    req.tenant_id = _enforce_token_tenant(current_user, req.tenant_id)
    req.user_id = str(current_user.get("user_id") or "") or None
    validator = AgentValidator(db)
    result = validator.validate_query(req.dict())
    
    # Audit logging
    try:
        tid = req.tenant_id
        cid = uuid.UUID(req.company_id) if req.company_id else None
        
        audit = AgentQueryAudit(
            tenant_id=tid,
            company_id=cid,
            user_id=uuid.UUID(req.user_id) if req.user_id else None,
            query_sql=req.sql_preview,
            status="planned" if result["allowed"] else "blocked",
            records_returned=0,
            response_time_ms=0,
            error_message=result.get("blocked_reason")
        )
        db.add(audit)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Falha ao gravar auditoria de validate-query (tenant=%s)", req.tenant_id)

    return result

@router.post("/execute-query")
async def execute_query(
    req: ExecuteQueryRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_current_user),
):
    req.tenant_id = _enforce_token_tenant(current_user, req.tenant_id)
    req.user_id = str(current_user.get("user_id") or "") or None
    # 1. Valida o SQL que será de fato executado (final_sql) — nunca apenas o preview.
    validator = AgentValidator(db)
    validation = validator.validate_query({**req.dict(), "sql_preview": req.final_sql})
    
    if not validation["allowed"]:
        raise HTTPException(status_code=403, detail=validation["blocked_reason"])
        
    # 2. Add limits / Masking
    final_sql = req.final_sql
    # (Here we could append limit dynamically based on validation["limit_apply"])
    
    # 3. Execute on Protheus
    config = get_tenant_config(req.tenant_id, req.environment_code)
    rest_url = config['rest_url'].strip()
    if rest_url.endswith('/'): rest_url = rest_url[:-1]
    url = f"{rest_url}/QueryRest"
    
    headers = await build_protheus_headers(
            req.tenant_id,
            config,
            environment_code=req.environment_code,
        )
    
    start_time = time.time()
    try:
        res_text = await _execute_http_post_with_retry(url, {"cQuery": final_sql}, headers)
        elapsed = int((time.time() - start_time) * 1000)
        
        records = 0
        try:
            parsed = json.loads(res_text)
            if isinstance(parsed, dict) and "items" in parsed:
                records = len(parsed["items"])
            elif isinstance(parsed, list):
                records = len(parsed)
        except:
            pass
            
        # 4. Success Audit & Usage Update
        try:
            tid = req.tenant_id
            cid = uuid.UUID(req.company_id) if req.company_id else None
            
            audit = AgentQueryAudit(
                tenant_id=tid,
                company_id=cid,
                user_id=uuid.UUID(req.user_id) if req.user_id else None,
                query_sql=final_sql,
                status="success",
                records_returned=records,
                response_time_ms=elapsed
            )
            db.add(audit)
            
            if tid:
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.tenant_id == str(tid)).first()
                if usage:
                    usage.total_queries += 1
            db.commit()
        except:
            db.rollback()
            
        return {"status": "success", "records": records, "data": res_text}
        
    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        # Log error
        try:
            tid = req.tenant_id
            audit = AgentQueryAudit(
                tenant_id=tid,
                query_sql=final_sql,
                status="error",
                records_returned=0,
                response_time_ms=elapsed,
                error_message=str(e)
            )
            db.add(audit)
            db.commit()
        except:
            db.rollback()
            
        logger.exception("Falha na execução QueryRest (tenant=%s)", req.tenant_id)
        raise HTTPException(status_code=502, detail="Falha ao executar a consulta no Protheus.")

@router.get("/usage/{tenant_id}/{period_ref}")
def get_usage(
    tenant_id: str,
    period_ref: str,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    # period_ref expected as 'YYYY-MM'
    authorize_admin_access(admin, "audit:read", tenant_id)
    try:
        t_str = str(tenant_id or '').strip()
        tenant = db.query(Tenant).filter(Tenant.tenant_code == t_str).first()
        if not tenant and t_str.isdigit():
            tenant = db.query(Tenant).filter(Tenant.id == int(t_str)).first()
        if not tenant: raise Exception("Tenant not found")
        
        usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.tenant_id == str(tenant.id)).first()
        if usage:
            max_q = usage.overage_queries or 1000
            return {
                "period": period_ref,
                "current_queries": usage.total_queries,
                "max_queries": max_q,
                "status": "within_limits" if usage.total_queries < max_q else "exceeded"
            }
        return {"period": period_ref, "current_queries": 0, "max_queries": 1000, "status": "within_limits"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ValidateContextRequest(BaseModel):
    tenant_id: str
    environment_code: str
    company: str

    branch: str
    user: str
    profile: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/validate-context")
async def proxy_validate_context(
    req: ValidateContextRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_current_user),
):
    req.tenant_id = _enforce_token_tenant(current_user, req.tenant_id)
    try:
        from app.services.protheus_queryrest_client import ProtheusQueryRestClient
        client = ProtheusQueryRestClient(
            db=db,
            tenant_code=req.tenant_id,
            environment_code=req.environment_code
        )
        res = await client.execute("SELECT 'OK' AS STATUS FROM DUAL")
        return {
            "ready": True, 
            "message": "Contexto validado via API V2 (QueryRest OK).",
            "environment": req.environment_code,
            "company": req.company,
            "branch": req.branch
        }
    except Exception as e:
        return {"ready": False, "message": f"Erro de integração (Cloud -> Protheus V2): {str(e)}"}

class AskAgentRequest(BaseModel):
    tenant_id: str
    environment_code: str
    company: str

    branch: str
    user: str
    request_id: str
    prompt: str

@router.post("/ask")
async def proxy_ask_agent(
    req: AskAgentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_current_user),
):
    req.tenant_id = _enforce_token_tenant(current_user, req.tenant_id)
    try:
        config = get_tenant_config(req.tenant_id, req.environment_code)
        rest_url = config['rest_url'].strip()
        if not rest_url.startswith("http://") and not rest_url.startswith("https://"):
            rest_url = "https://" + rest_url
        if rest_url.endswith('/'): rest_url = rest_url[:-1]
        
        # Endpoint AdvPL
        url = f"{rest_url}/copilot/ask"
        
        headers = await build_protheus_headers(
            req.tenant_id,
            config,
            environment_code=req.environment_code,
        )
        
        res_text = await _execute_http_post_with_retry(url, req.dict(), headers)
        return json.loads(res_text)
    except Exception as e:
        return {"summary": f"Erro na requisição ao ERP: {str(e)}"}

