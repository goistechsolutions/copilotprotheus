"""Regressões P0: autenticação do agente, tenant do token, final_sql validado, segredos e X-Admin-Key."""
import importlib
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import agent_routes
from app.core.auth import require_current_user
from app.db.database import get_db

GOOD_SQL = "SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*'"
BODY = {"tenant_id": "tenant_a", "environment_code": "prd", "sql_preview": GOOD_SQL}


def _fake_db():
    db = MagicMock()
    db.query.return_value.filter.return_value.count.return_value = 0
    return db


@pytest.fixture
def app_factory():
    def make(user=None):
        app = FastAPI()
        app.include_router(agent_routes.router, prefix="/api")
        app.dependency_overrides[get_db] = _fake_db
        if user is not None:
            app.dependency_overrides[require_current_user] = lambda: user
        return TestClient(app)
    return make


@pytest.mark.parametrize("path,body", [
    ("/api/agent/validate-query", BODY),
    ("/api/agent/execute-query", {**BODY, "final_sql": GOOD_SQL}),
    ("/api/agent/validate-context", {"tenant_id": "tenant_a", "environment_code": "prd", "company": "01", "branch": "01", "user": "u"}),
    ("/api/agent/ask", {"tenant_id": "tenant_a", "environment_code": "prd", "company": "01", "branch": "01", "user": "u", "request_id": "r", "prompt": "p"}),
])
def test_agent_routes_require_authentication(app_factory, path, body):
    assert app_factory().post(path, json=body).status_code == 401


def test_usage_requires_admin(app_factory):
    assert app_factory().get("/api/agent/usage/tenant_a/2026-10").status_code == 401


def test_tenant_in_body_must_match_token(app_factory):
    client = app_factory({"tenant_id": "tenant_b", "user_id": "u1"})
    r = client.post("/api/agent/execute-query", json={**BODY, "final_sql": GOOD_SQL})
    assert r.status_code == 403


def test_execute_validates_final_sql_not_preview(app_factory, monkeypatch):
    calls = []

    async def fake_post(*a, **k):
        calls.append(a)
        return "[]"

    monkeypatch.setattr(agent_routes, "_execute_http_post_with_retry", fake_post)
    monkeypatch.setattr(agent_routes, "get_tenant_config", lambda *a, **k: {"rest_url": "https://x"})

    async def fake_headers(*a, **k):
        return {}

    monkeypatch.setattr(agent_routes, "build_protheus_headers", fake_headers)
    client = app_factory({"tenant_id": "tenant_a", "user_id": "u1"})

    # preview inocente, final_sql malicioso -> deve bloquear e NÃO chamar o Protheus
    evil = {**BODY, "final_sql": "DELETE FROM SE1010"}
    assert client.post("/api/agent/execute-query", json=evil).status_code == 403
    assert calls == []

    # SQL legítimo passa e é exatamente o executado
    ok = client.post("/api/agent/execute-query", json={**BODY, "final_sql": GOOD_SQL})
    assert ok.status_code == 200 and len(calls) == 1
    assert calls[0][1] == {"cQuery": GOOD_SQL}


def test_user_id_comes_from_token_not_body(app_factory, monkeypatch):
    seen = {}
    real = agent_routes.AgentValidator.validate_query

    def spy(self, payload):
        seen.update(payload)
        return real(self, payload)

    monkeypatch.setattr(agent_routes.AgentValidator, "validate_query", spy)
    client = app_factory({"tenant_id": "tenant_a", "user_id": "11111111-1111-1111-1111-111111111111"})
    client.post("/api/agent/validate-query", json={**BODY, "user_id": "99999999-9999-9999-9999-999999999999"})
    assert seen["user_id"] == "11111111-1111-1111-1111-111111111111"


# ---- segredos fail-fast
def test_required_secret_rules(monkeypatch):
    from app.core.secret_env import get_required_secret
    monkeypatch.delenv("X_SECRET", raising=False)
    with pytest.raises(RuntimeError):
        get_required_secret("X_SECRET")
    monkeypatch.setenv("X_SECRET", "curto")
    with pytest.raises(RuntimeError):
        get_required_secret("X_SECRET")
    monkeypatch.setenv("X_SECRET", "copilot-protheus-dev-secret-change-me")
    with pytest.raises(RuntimeError):
        get_required_secret("X_SECRET")
    monkeypatch.setenv("X_SECRET", "a" * 40)
    assert get_required_secret("X_SECRET") == "a" * 40


# ---- X-Admin-Key
def test_admin_key_rejects_signing_secret(monkeypatch):
    from fastapi import HTTPException
    from app.api import company_routes
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-admin-longa-123")
    monkeypatch.setenv("JWT_SECRET", "j" * 40)
    monkeypatch.setenv("ADMIN_JWT_SECRET", "k" * 40)
    with pytest.raises(HTTPException):
        company_routes.verify_admin_key(x_admin_key="j" * 40, admin_token=None)
    with pytest.raises(HTTPException):
        company_routes.verify_admin_key(x_admin_key="k" * 40, admin_token=None)
    assert company_routes.verify_admin_key(x_admin_key="senha-admin-longa-123", admin_token=None)


# ---- CORS
def test_cors_does_not_reflect_arbitrary_origin():
    from app.main import app
    client = TestClient(app)
    evil = client.options(
        "/api/agent/ask/v2",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in {k.lower() for k in evil.headers}
    good = client.options(
        "/api/agent/ask/v2",
        headers={"Origin": "https://copilot.elitecorp.tec.br", "Access-Control-Request-Method": "POST"},
    )
    assert good.headers.get("access-control-allow-origin") == "https://copilot.elitecorp.tec.br"
