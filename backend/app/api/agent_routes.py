from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import time
import json

from app.db.database import get_db
from app.services.agent_service import AgentValidator
from app.services.protheus_service import _execute_http_post_with_retry, get_tenant_config
from app.models.knowledge import AgentQueryAudit, QueryUsageCounter

router = APIRouter(prefix="/agent", tags=["agent-execution"])

class TableUsed(BaseModel):
    table_id: str
    snapshot_id: str

class FieldUsed(BaseModel):
    table_id: str
    field_id: str
    field_name: str

class ValidateQueryRequest(BaseModel):
    tenant_id: str
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
def validate_query(req: ValidateQueryRequest, db: Session = Depends(get_db)):
    validator = AgentValidator(db)
    result = validator.validate_query(req.dict())
    
    # Audit logging
    try:
        tid = uuid.UUID(req.tenant_id)
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
    except Exception as e:
        db.rollback()
        
    return result

@router.post("/execute-query")
async def execute_query(req: ExecuteQueryRequest, db: Session = Depends(get_db)):
    # 1. Validate again (or trust validate endpoint, but safe to re-validate)
    validator = AgentValidator(db)
    validation = validator.validate_query(req.dict())
    
    if not validation["allowed"]:
        raise HTTPException(status_code=403, detail=validation["blocked_reason"])
        
    # 2. Add limits / Masking
    final_sql = req.final_sql
    # (Here we could append limit dynamically based on validation["limit_apply"])
    
    # 3. Execute on Protheus
    config = get_tenant_config(req.tenant_id)
    rest_url = config['rest_url'].strip()
    if rest_url.endswith('/'): rest_url = rest_url[:-1]
    url = f"{rest_url}/QueryRest"
    
    headers = {
        "Authorization": f"Bearer {config['token']}",
        "Content-Type": "application/json"
    }
    
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
            tid = uuid.UUID(req.tenant_id)
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
            
            if cid:
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.company_id == cid).first()
                if usage:
                    usage.current_queries += 1
            db.commit()
        except:
            db.rollback()
            
        return {"status": "success", "records": records, "data": res_text}
        
    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        # Log error
        try:
            tid = uuid.UUID(req.tenant_id)
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
            
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage/{tenant_id}/{period_ref}")
def get_usage(tenant_id: str, period_ref: str, db: Session = Depends(get_db)):
    # period_ref expected as 'YYYY-MM'
    # Simplified search by tenant
    try:
        tid = uuid.UUID(tenant_id)
        # Assuming we just get the first one for the tenant for now (actually linked to company in v4, but endpoint says tenant_id)
        from app.models.knowledge import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == tid).first()
        if not tenant: raise Exception("Tenant not found")
        
        usage = db.query(QueryUsageCounter).first() # Simplified
        if usage:
            return {
                "period": period_ref,
                "current_queries": usage.current_queries,
                "max_queries": usage.max_queries,
                "status": "within_limits" if usage.current_queries < usage.max_queries else "exceeded"
            }
        return {"period": period_ref, "current_queries": 0, "max_queries": 1000, "status": "within_limits"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ValidateContextRequest(BaseModel):
    tenant_id: str
    company: str
    branch: str
    user: str
    profile: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/validate-context")
async def proxy_validate_context(req: ValidateContextRequest, db: Session = Depends(get_db)):
    try:
        config = get_tenant_config(req.tenant_id)
        rest_url = config['rest_url'].strip()
        if rest_url.endswith('/'): rest_url = rest_url[:-1]
        
        # Endpoint AdvPL
        url = f"{rest_url}/copilot/validate-context"
        
        headers = {
            "Authorization": f"Bearer {config['token']}",
            "Content-Type": "application/json"
        }
        
        res_text = await _execute_http_post_with_retry(url, req.dict(), headers)
        return json.loads(res_text)
    except Exception as e:
        return {"ready": False, "message": f"Erro de integração (Cloud -> Protheus): {str(e)}"}

class AskAgentRequest(BaseModel):
    tenant_id: str
    company: str
    branch: str
    user: str
    request_id: str
    prompt: str

@router.post("/ask")
async def proxy_ask_agent(req: AskAgentRequest, db: Session = Depends(get_db)):
    try:
        config = get_tenant_config(req.tenant_id)
        rest_url = config['rest_url'].strip()
        if rest_url.endswith('/'): rest_url = rest_url[:-1]
        
        # Endpoint AdvPL
        url = f"{rest_url}/copilot/ask"
        
        headers = {
            "Authorization": f"Bearer {config['token']}",
            "Content-Type": "application/json"
        }
        
        res_text = await _execute_http_post_with_retry(url, req.dict(), headers)
        return json.loads(res_text)
    except Exception as e:
        return {"summary": f"Erro na requisição ao ERP: {str(e)}"}

