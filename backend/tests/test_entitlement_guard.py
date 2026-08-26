import pytest
from fastapi import HTTPException

from app.services.entitlement_guard import EntitlementDecision, EntitlementDenied, EntitlementGuard
from app.services.protheus_context_service import mask_sensitive_rows, validate_query_security


class FakeResult:
    def __init__(self, value=None, rows=None):
        self.value = value
        self.rows = rows or []

    def scalar(self):
        return self.value

    def mappings(self):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class UsageDB(FakeDB):
    def __init__(self, usage_row=None):
        super().__init__()
        self.usage_row = usage_row

    def execute(self, query, params=None):
        sql = str(query).lower()
        if "to_char(current_date" in sql:
            return FakeResult(value="2026-08")
        if "from public.query_usage_counters" in sql:
            return FakeResult(rows=[self.usage_row] if self.usage_row else [])
        return super().execute(query, params)


class SessionLimitDB(FakeDB):
    def execute(self, query, params=None):
        sql = str(query).lower()
        if "update public.concurrent_sessions" in sql:
            return FakeResult()
        if "select id" in sql and "public.concurrent_sessions" in sql:
            return FakeResult(value=None)
        if "select count(*)" in sql and "public.concurrent_sessions" in sql:
            return FakeResult(value=2)
        return super().execute(query, params)


class FakeDB:
    def __init__(self, tenant=True, contract=None, user=None, module=None, table_permissions=None, field_permissions=None):
        self.tenant = tenant
        self.contract = contract
        self.user = user
        self.module = module
        self.table_permissions = table_permissions or []
        self.field_permissions = field_permissions or []
        self.bind = type("Bind", (), {"dialect": type("Dialect", (), {"name": "sqlite"})()})()
        self.commits = 0
        self.rollbacks = 0

    def execute(self, query, params=None):
        sql = str(query)
        if "FROM public.tenant_contracts" in sql:
            return FakeResult(rows=[self.contract] if self.contract else [])
        if "FROM public.users" in sql:
            return FakeResult(rows=[self.user] if self.user else [])
        if "FROM public.tenant_module_contracts" in sql:
            return FakeResult(rows=[self.module] if self.module else [])
        if "FROM public.tenant" in sql:
            return FakeResult(rows=[{"schema_name": "rodol_prod"}] if self.tenant else [])
        if "information_schema.tables" in sql:
            return FakeResult(value=True)
        if "tenant_table_permissions" in sql:
            return FakeResult(rows=self.table_permissions)
        if "tenant_field_permissions" in sql:
            return FakeResult(rows=self.field_permissions)
        raise AssertionError(f"Consulta inesperada no fake: {sql}")

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def entitlement_decision(**overrides):
    values = {
        "allowed": True,
        "mode": "enforce",
        "tenant_code": "rodol_prod",
        "environment_code": "c8te0u_prod",
        "module_code": "FAT",
        "contract_id": "contract-1",
        "query_limit": 3,
        "overage_mode": "block",
        "concurrent_sessions_limit": 2,
        "user_id": "user-1",
    }
    values.update(overrides)
    return EntitlementDecision(**values)


def active_contract():
    return {
        "contract_id": "contract-1",
        "contract_code": "CTR-001",
        "plan_code": "pro",
        "query_limit": 100,
        "concurrent_sessions_limit": 2,
        "overage_mode": "block",
    }


def active_user():
    return {"user_id": "user-1", "role_id": "role-1", "status": "active"}


def active_module():
    return {"module_id": "module-1", "mod_code": "5", "mod_sigla": "FAT", "status": "allowed"}


def test_invalid_context_is_denied_without_database_access():
    guard = EntitlementGuard(mode="enforce")
    decision = guard.evaluate(
        FakeDB(),
        tenant_code="",
        environment_code="c8te0u_prod",
        module_code="5",
        user_identity="user-1",
    )

    assert decision.allowed is False
    assert decision.issues[0]["code"] == "TENANT_REQUIRED"


def test_active_contract_user_and_module_are_allowed():
    guard = EntitlementGuard(mode="enforce")
    decision = guard.evaluate(
        FakeDB(contract=active_contract(), user=active_user(), module=active_module()),
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        module_code="FAT",
        user_identity="user-1",
    )

    assert decision.allowed is True
    assert decision.contract_id == "contract-1"
    assert decision.plan_code == "pro"
    assert decision.role_id == "role-1"
    assert decision.query_limit == 100


def test_missing_contract_denies_entitlement():
    guard = EntitlementGuard(mode="enforce")
    decision = guard.evaluate(
        FakeDB(contract=None),
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        module_code="FAT",
        user_identity="user-1",
    )

    assert decision.allowed is False
    assert decision.issues[0]["code"] == "LICENSE_NOT_ACTIVE"


def test_table_and_field_permissions_keep_table_scope():
    guard = EntitlementGuard(mode="enforce")
    db = FakeDB(
        table_permissions=[{"table_name": "SF2"}],
        field_permissions=[
            {"table_name": "SF2", "field_name": "F2_DOC", "can_select": True, "can_filter": True, "masked_flag": False},
            {"table_name": "SD2", "field_name": "D2_DOC", "can_select": True, "can_filter": True, "masked_flag": False},
        ],
    )

    allowed_tables, fields_by_table = guard.authorize_dictionary(
        db,
        tenant_schema="rodol_prod",
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        company_id=1,
        role_id="role-1",
        table_names={"SF2010", "SD2010"},
    )

    assert allowed_tables == {"SF2", "SF2010"}
    assert fields_by_table["SF2"] == {"F2_DOC"}
    assert fields_by_table["SF2010"] == {"F2_DOC"}
    assert "D2_DOC" not in fields_by_table


def test_dictionary_authorization_returns_filter_and_masked_fields():
    guard = EntitlementGuard(mode="enforce")
    db = FakeDB(
        table_permissions=[{"table_name": "SA1"}],
        field_permissions=[
            {"table_name": "SA1", "field_name": "A1_COD", "can_select": True, "can_filter": True, "masked_flag": False},
            {"table_name": "SA1", "field_name": "A1_EMAIL", "can_select": True, "can_filter": False, "masked_flag": True},
            {"table_name": "SA1", "field_name": "A1_INTERNAL", "can_select": False, "can_filter": True, "masked_flag": True},
        ],
    )

    authorization = guard.authorize_dictionary_details(
        db,
        tenant_schema="rodol_prod",
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        company_id=1,
        role_id="role-1",
        table_names={"SA1010"},
    )

    assert authorization.allowed_tables == {"SA1", "SA1010"}
    assert authorization.allowed_fields_by_table["SA1010"] == {"A1_COD", "A1_EMAIL"}
    assert authorization.filter_fields_by_table["SA1010"] == {"A1_COD", "A1_INTERNAL"}
    assert authorization.masked_fields_by_table["SA1010"] == {"A1_EMAIL"}


def test_query_guard_rejects_filter_field_without_can_filter():
    with pytest.raises(HTTPException, match="não autorizados no WHERE"):
        validate_query_security(
            sql="SELECT A1_COD FROM SA1010 A1 WHERE A1.A1_NOME = 'fixture' AND A1.D_E_L_E_T_ <> '*' FETCH FIRST 10 ROWS ONLY",
            allowed_tables={"SA1"},
            filial="0101",
            allowed_fields={"A1_COD", "A1_NOME"},
            allowed_fields_by_table={"SA1": {"A1_COD", "A1_NOME"}},
            filter_fields_by_table={"SA1": {"A1_COD"}},
        )


def test_masked_dictionary_field_is_masked_before_response():
    rows = [{"A1_EMAIL": "fixture@example.invalid", "A1_COD": "000001"}]

    safe_rows = mask_sensitive_rows(rows, masked_fields={"A1_EMAIL"})

    assert safe_rows == [{"A1_EMAIL": "********************", "A1_COD": "000001"}]


def test_query_limit_blocks_when_counter_reaches_limit():
    guard = EntitlementGuard(mode="enforce")
    db = UsageDB({"total_queries": 3, "blocked_queries": 0, "overage_queries": 0})

    with pytest.raises(EntitlementDenied, match="Limite de consultas") as error:
        guard._reserve_query(db, entitlement_decision(), "corr-limit")

    assert error.value.code == "QUERY_LIMIT_EXCEEDED"
    assert db.commits == 1


def test_query_limit_allows_overage_when_contract_allows_it():
    guard = EntitlementGuard(mode="enforce")
    db = UsageDB({"total_queries": 3, "blocked_queries": 0, "overage_queries": 0})
    decision = entitlement_decision(overage_mode="allow")

    guard._reserve_query(db, decision, "corr-overage")

    assert decision.queries_used == 4
    assert decision.remaining_queries == 0
    assert db.commits == 1


def test_concurrent_session_limit_blocks_new_session():
    guard = EntitlementGuard(mode="enforce")
    db = SessionLimitDB()

    with pytest.raises(EntitlementDenied, match="conexões simultâneas") as error:
        guard._acquire_session(db, entitlement_decision(), "session-new", "user-1")

    assert error.value.code == "CONCURRENT_SESSION_LIMIT_EXCEEDED"


def test_authorize_does_not_reserve_until_explicit_reserve_call(monkeypatch):
    guard = EntitlementGuard(mode="enforce")
    db = FakeDB(contract=active_contract(), user=active_user(), module=active_module())
    calls = []
    monkeypatch.setattr(guard, "_reserve_query", lambda *_args: calls.append("query"))
    monkeypatch.setattr(guard, "_acquire_session", lambda *_args: calls.append("session"))
    monkeypatch.setattr(guard, "_audit", lambda *_args: calls.append("audit"))

    decision = guard.authorize(
        db,
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        module_code="FAT",
        user_identity="user-1",
    )

    assert decision.allowed is True
    assert calls == []
    guard.reserve(db, decision, session_key="session-1", correlation_id="corr-1")
    assert calls == ["query", "session", "audit"]


def test_missing_role_does_not_grant_dictionary_access():
    guard = EntitlementGuard(mode="enforce")
    allowed_tables, fields_by_table = guard.authorize_dictionary(
        FakeDB(),
        tenant_schema="rodol_prod",
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        company_id=1,
        role_id=None,
        table_names={"SF2"},
    )

    assert allowed_tables == set()
    assert fields_by_table == {}
