import asyncio
from types import SimpleNamespace

from app.api.agent_sql_routes import AGENT_TASKS, ask_v2_status
from app.services.protheus_context_resolver import resolve_company


class _Result:
    def __init__(self, row):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row


class _DB:
    def __init__(self, row):
        self.row = row
        self.sql = ""

    def execute(self, statement, params):
        self.sql = str(statement)
        return _Result(self.row)


def test_resolve_company_accepts_existing_portuguese_active_status():
    db = _DB(
        {
            "id": 1,
            "company_code": "01",
            "company_name": "Rodol Ltda",
            "branch_code": "0101",
            "status": "ativa",
        }
    )

    company = resolve_company(db, "rodol_prod", None, "01", "0101")

    assert company["id"] == 1
    assert "LOWER(status) IN ('active', 'ativa')" in db.sql


def test_resolve_company_does_not_invent_company_when_no_active_row():
    db = _DB(None)

    company = resolve_company(db, "rodol_prod", None, "01", "0101")

    assert company is None
    assert "LOWER(status) IN ('active', 'ativa')" in db.sql


def test_resolve_company_preserves_tenant_schema_scope():
    db = _DB({"id": 7, "status": "active"})

    resolve_company(db, "rodol_prod", 7, None, None)

    assert 'FROM "rodol_prod".company_info' in db.sql
    assert "FROM public.company_info" not in db.sql


def test_ask_v2_status_preserves_specific_context_error():
    task_id = "test-context-error-shape"
    AGENT_TASKS[task_id] = {
        "status": "error",
        "error": "environment_code real é obrigatório para execução no Protheus.",
        "error_code": "INVALID_CONTEXT",
        "correlation_id": "test-correlation",
    }

    try:
        result = asyncio.run(ask_v2_status(task_id))
    finally:
        AGENT_TASKS.pop(task_id, None)

    assert result["error"] == "environment_code real é obrigatório para execução no Protheus."
    assert result["error_code"] == "INVALID_CONTEXT"
    assert result["summary"] == result["error"]


__all__ = ["SimpleNamespace"]
