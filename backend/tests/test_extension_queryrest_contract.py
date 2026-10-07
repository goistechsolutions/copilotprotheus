import asyncio
import os

os.environ.setdefault("JWT_SECRET", "x" * 32)

from app.api import agent_sql_routes
from app.services.protheus_context_resolver import ProtheusContext


class FakeMappings:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDB:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, statement, params=None):
        sql = str(statement).lower()
        params = params or {}
        if "information_schema.columns" in sql:
            table_name = params.get("table_name")
            columns_by_table = {
                "dictionary_fields": {
                    "field_name", "title", "field_type", "length_num", "decimal_num",
                    "validation_rule", "relation_rule", "when_rule", "sxg_group", "sxg_size",
                    "table_name", "table_code", "environment_id", "id",
                },
                "dictionary_indexes": {"table_name", "index_order", "nickname", "expression"},
            }
            columns = columns_by_table.get(table_name, set())
            return FakeMappings([{"column_name": column} for column in columns])
        if "dictionary_fields" in sql:
            return FakeMappings([
                {
                    "field_name": "A1_COD",
                    "field_label": "Código",
                    "field_type": "C",
                    "field_length": 6,
                    "field_decimal": 0,
                }
            ])
        if "dictionary_indexes" in sql:
            return FakeMappings([])
        return FakeMappings([])

    def commit(self):
        pass


def test_history_scope_casts_company_id_for_legacy_schema_types():
    captured = {}

    class HistoryDB:
        def execute(self, statement, params=None):
            captured["sql"] = str(statement)
            captured["params"] = params
            return FakeMappings([])

    result = agent_sql_routes._load_conversation_history(
        db=HistoryDB(),
        tenant_schema="rodol_prod",
        tenant_id="rodol_prod",
        company_id=7,
        conversation_id="conversation-1",
        actor_key="operador",
    )

    assert result == []
    assert "company_id::text = CAST(:company_id AS text)" in captured["sql"]
    assert captured["params"]["company_id"] == "7"


def test_tenant_bootstrap_requires_agent_memories_columns():
    from app.db.database import TENANT_REQUIRED_COLUMNS

    assert {
        "id",
        "tenant_id",
        "company_id",
        "memory_key",
        "memory_value",
        "memory_type",
        "scope",
        "source",
        "created_at",
    }.issubset(TENANT_REQUIRED_COLUMNS["memories"])


def test_extension_context_reaches_queryrest_with_explicit_environment(monkeypatch):
    calls = {}

    context = ProtheusContext(
        tenant_id="rodol_prod",
        schema_name="rodol_prod",
        company_id=7,
        company_code="01",
        branch="0101",
        module_code="5",
        module_sigla="SIGAFAT",
        module_name="Faturamento",
        user="operador",
        profile="analista",
    )

    async def fake_sql_generator(**kwargs):
        calls["generator_environment"] = kwargs["environment_code"]
        calls["generator_tenant"] = kwargs["tenant_id"]
        return "SELECT A1_COD FROM SA1010 WHERE D_E_L_E_T_ <> '*'"

    async def fake_queryrest_exec_tenant(**kwargs):
        calls.update({
            "queryrest_tenant": kwargs["tenant_id"],
            "queryrest_environment": kwargs["environment_code"],
            "query": kwargs["query"],
        })
        return [{"A1_COD": "000001"}]

    monkeypatch.setattr(agent_sql_routes, "SessionLocal", lambda: FakeDB())
    monkeypatch.setattr(agent_sql_routes, "build_protheus_context", lambda **_: {"xfilial": "0101"})
    import app.services.protheus_context_resolver
    import app.services.protheus_module_catalog
    monkeypatch.setattr(app.services.protheus_module_catalog, "filter_allowed_dictionary_tables", lambda **_: [
        {"table_code": "SA1", "table_name": "SA1010", "module_code": "5"}
    ])
    monkeypatch.setattr(agent_sql_routes, "real_llm_sql_generator", fake_sql_generator)
    monkeypatch.setattr(agent_sql_routes, "validate_query_security", lambda **_: None)
    monkeypatch.setattr(agent_sql_routes, "queryrest_exec_tenant", fake_queryrest_exec_tenant)
    monkeypatch.setattr(app.services.protheus_context_resolver, "resolve_context", lambda *_: context)

    import app.db.database
    import app.core.rate_limit
    import app.services.entitlement_guard
    from app.services.entitlement_guard import EntitlementDecision
    monkeypatch.setattr(app.db.database, "ensure_tenant_tables", lambda *_: None)
    monkeypatch.setattr(app.core.rate_limit, "check_tenant_rate_limit", lambda *_: {})
    monkeypatch.setattr(
        app.services.entitlement_guard.EntitlementGuard,
        "authorize",
        lambda *_, **__: EntitlementDecision(
            allowed=True,
            mode="enforce",
            tenant_code="rodol_prod",
            environment_code="c8te0u_prod",
            module_code="5",
        ),
    )
    monkeypatch.setattr(
        app.services.entitlement_guard.EntitlementGuard,
        "reserve",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        app.services.entitlement_guard.EntitlementGuard,
        "release_session",
        lambda *_, **__: None,
    )
    agent_sql_routes.AGENT_TASKS.clear()
    payload = {
        "query": "listar clientes",
        "tenant_id": "rodol_prod",
        "environment_code": "c8te0u_prod",
        "company_id": 7,
        "execute": True,
        "context": {
            "tenant_id": "rodol_prod",
            "environment_code": "c8te0u_prod",
            "company_code": "01",
            "branch": "0101",
            "module": "SIGAFAT",
            "user": "operador",
        },
    }

    asyncio.run(agent_sql_routes.process_agent_task("contract-test", payload))
    result = agent_sql_routes.AGENT_TASKS["contract-test"]

    assert result["status"] == "success"
    assert result["data"] == [{"A1_COD": "000001"}]
    assert calls["generator_tenant"] == "rodol_prod"
    assert calls["generator_environment"] == "c8te0u_prod"
    assert calls["queryrest_tenant"] == "rodol_prod"
    assert calls["queryrest_environment"] == "c8te0u_prod"
    assert "D_E_L_E_T_ <> '*'" in calls["query"]
