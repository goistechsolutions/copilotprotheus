import re
from datetime import datetime
from sqlalchemy.orm import Session
import uuid
import logging
from app.models.knowledge import (
    TenantContract, QueryUsageCounter, ConcurrentSession,
    V4TenantAllowedTable, V4TenantAllowedField, AgentQueryAudit
)

logger = logging.getLogger(__name__)

class AgentValidator:
    def __init__(self, db: Session):
        self.db = db

    def validate_query(self, payload: dict) -> dict:
        """
        Executa os Steps A-F de validação da V5.
        """
        tenant_id = payload.get("tenant_id")
        contract_id = payload.get("contract_id")
        user_id = payload.get("user_id")
        tables_used = payload.get("tables_used", [])
        fields_used = payload.get("fields_used", [])
        sql_preview = payload.get("sql_preview", "")
        
        try:
            tid = uuid.UUID(tenant_id)
            cid = uuid.UUID(contract_id) if contract_id else None
        except Exception:
            return self._block("invalid_ids")
            
        # Step A: Contract
        if cid:
            contract = self.db.query(TenantContract).filter(
                TenantContract.id == cid,
                TenantContract.status == "active"
            ).first()
            if not contract:
                return self._block("contract_inactive")
                
        # Step B: Quota
        company_id = payload.get("company_id")
        if company_id:
            try:
                comp_id = uuid.UUID(company_id)
                usage = self.db.query(QueryUsageCounter).filter(QueryUsageCounter.company_id == comp_id).first()
                if usage and usage.current_queries >= usage.max_queries:
                    return self._block("quota_exceeded")
            except Exception:
                pass
                
        # Step C: Concurrent sessions
        active_sessions = self.db.query(ConcurrentSession).filter(
            ConcurrentSession.tenant_id == tid,
            ConcurrentSession.status == "active"
        ).count()
        if active_sessions > 10: 
            return self._block("concurrent_limit_exceeded")
            
        # Step D: Scope allowed
        blocked_reason = None
        masked_fields = []
        
        if not tables_used and " FROM " not in sql_preview.upper():
            return self._block("invalid_sql")
            
        for t in tables_used:
            t_id = t.get("table_id")
            s_id = t.get("snapshot_id")
            if not t_id or not s_id:
                return self._block("table_not_allowed")
            allowed_t = self.db.query(V4TenantAllowedTable).filter(
                V4TenantAllowedTable.table_id == uuid.UUID(t_id),
                V4TenantAllowedTable.snapshot_id == uuid.UUID(s_id),
                V4TenantAllowedTable.allowed == True
            ).first()
            if not allowed_t:
                return self._block("table_not_allowed")
                
        # Fields
        for f in fields_used:
            f_id = f.get("field_id")
            if f_id:
                allowed_f = self.db.query(V4TenantAllowedField).filter(
                    V4TenantAllowedField.field_id == uuid.UUID(f_id)
                ).first()
                if allowed_f:
                    if not allowed_f.allowed:
                        return self._block("field_not_allowed")
                    if allowed_f.masking_required:
                        masked_fields.append(f.get("field_name"))
                        
        # Step E: Security Rules
        upper_sql = sql_preview.upper()
        forbidden_tokens = ["UPDATE ", "INSERT ", "DELETE ", "DROP ", "ALTER ", "EXEC ", "CREATE "]
        if any(token in upper_sql for token in forbidden_tokens):
            return self._block("forbidden_sql")
            
        if "SELECT *" in upper_sql:
            return self._block("select_star_forbidden")
            
        if "D_E_L_E_T_" not in upper_sql:
            return self._block("missing_delet_filter")
            
        # Step F: Volume Control
        limit_apply = {}
        if "WHERE" not in upper_sql:
            limit_apply["row_limit"] = 100
        else:
            limit_apply["row_limit"] = 1000
            
        return {
            "allowed": True,
            "blocked_reason": None,
            "enforcement_actions": ["mask_fields"] if masked_fields else [],
            "masked_fields": masked_fields,
            "limit_apply": limit_apply
        }
        
    def _block(self, reason: str):
        return {
            "allowed": False,
            "blocked_reason": reason,
            "enforcement_actions": ["block"],
            "masked_fields": [],
            "limit_apply": {}
        }
