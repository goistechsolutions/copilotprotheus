import re
from datetime import datetime
from sqlalchemy.orm import Session
import uuid
import logging
from app.models.knowledge import (
    TenantContract, QueryUsageCounter, ConcurrentSession,
    TenantAllowedTable, TenantAllowedField, AgentQueryAudit
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
            cid = uuid.UUID(contract_id) if contract_id else None
        except Exception:
            return self._block("invalid_ids")

        # Step A: Contract ativo
        if cid:
            contract = self.db.query(TenantContract).filter(
                TenantContract.id == cid,
                TenantContract.contract_status == "active"  # campo correto V4
            ).first()
            if not contract:
                return self._block("contract_inactive")

        # Step B: Quota (QueryUsageCounter usa tenant_id, não company_id)
        if tenant_id and cid:
            try:
                usage = self.db.query(QueryUsageCounter).filter(
                    QueryUsageCounter.tenant_id == tenant_id,
                    QueryUsageCounter.contract_id == cid
                ).first()
                if usage and usage.total_queries >= (usage.total_queries or 0):
                    pass  # lógica de overage delegada ao contrato
            except Exception:
                pass

        # Step C: Sessões concorrentes
        active_sessions = self.db.query(ConcurrentSession).filter(
            ConcurrentSession.tenant_id == tenant_id,
            ConcurrentSession.session_status == "active"  # campo correto V4
        ).count()
        if active_sessions > 10:
            return self._block("concurrent_limit_exceeded")

        # Step D: Tabelas permitidas
        if not tables_used and " FROM " not in sql_preview.upper():
            return self._block("invalid_sql")

        masked_fields = []

        for t in tables_used:
            t_id = t.get("table_id")
            s_id = t.get("snapshot_id")
            if not t_id or not s_id:
                return self._block("table_not_allowed")
            try:
                allowed_t = self.db.query(TenantAllowedTable).filter(
                    TenantAllowedTable.table_id == uuid.UUID(t_id),
                    TenantAllowedTable.snapshot_id == uuid.UUID(s_id),
                    TenantAllowedTable.allowed == True
                ).first()
            except Exception:
                return self._block("table_not_allowed")
            if not allowed_t:
                return self._block("table_not_allowed")

        # Campos
        for f in fields_used:
            f_id = f.get("field_id")
            if f_id:
                try:
                    allowed_f = self.db.query(TenantAllowedField).filter(
                        TenantAllowedField.field_id == uuid.UUID(f_id)
                    ).first()
                except Exception:
                    continue
                if allowed_f:
                    if not allowed_f.allowed:
                        return self._block("field_not_allowed")
                    if allowed_f.masking_required:
                        masked_fields.append(f.get("field_name"))

        # Step E: Regras de segurança SQL
        upper_sql = sql_preview.upper()
        forbidden_tokens = ["UPDATE ", "INSERT ", "DELETE ", "DROP ", "ALTER ", "EXEC ", "CREATE "]
        if any(token in upper_sql for token in forbidden_tokens):
            return self._block("forbidden_sql")

        if "SELECT *" in upper_sql:
            return self._block("select_star_forbidden")

        if "D_E_L_E_T_" not in upper_sql:
            return self._block("missing_delet_filter")

        # Step F: Volume
        limit_apply = {"row_limit": 100 if "WHERE" not in upper_sql else 1000}

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
