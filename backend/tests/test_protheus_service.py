import asyncio
import json
import os

os.environ.setdefault("JWT_SECRET", "x" * 32)

import pytest

from app.services import protheus_service


class FakeSession:
    def close(self):
        pass


def test_context_requires_real_environment():
    with pytest.raises(protheus_service.ProtheusServiceError) as exc_info:
        protheus_service._require_context("rodol_prod", "default")

    assert exc_info.value.status_code == 400
    assert "environment_code" in str(exc_info.value)


def test_get_tenant_config_returns_only_connection_metadata(monkeypatch):
    connection = {
        "base_rest_url": "https://protheus.example/rest",
        "auth_mode": "oauth2_password",
        "protheus_username": "TECHNICAL_USER",
    }
    monkeypatch.setattr(protheus_service, "_public_db_session", lambda: FakeSession())
    monkeypatch.setattr(protheus_service, "load_connection", lambda db, tenant, environment: connection)

    result = protheus_service.get_tenant_config("rodol_prod", "c8te0u_prod")

    assert result["tenant_code"] == "rodol_prod"
    assert result["environment_code"] == "c8te0u_prod"
    assert result["auth_mode"] == "oauth2_password"
    assert "password" not in result
    assert "access_token" not in result
    assert "refresh_token" not in result


def test_queryrest_tool_delegates_to_central_client(monkeypatch):
    calls = {}

    async def fake_execute_queryrest(db, tenant_code, environment_code, query, *, method, payload=None):
        calls.update(
            tenant_code=tenant_code,
            environment_code=environment_code,
            query=query,
            method=method,
            payload=payload,
        )
        return {"items": [{"USR_MODULO": 5, "USR_CODMOD": "SIGAFAT"}]}

    monkeypatch.setattr(protheus_service, "_public_db_session", lambda: FakeSession())
    monkeypatch.setattr(protheus_service, "execute_queryrest", fake_execute_queryrest)

    result = asyncio.run(protheus_service.execute_protheus_tool(
        "QueryRest",
        {"cQuery": "SELECT USR_MODULO FROM SYS_USR_MODULE WHERE D_E_L_E_T_ <> '*'"},
        tenant_id="rodol_prod",
        environment_code="c8te0u_prod",
    ))

    assert json.loads(result)["items"][0]["USR_CODMOD"] == "SIGAFAT"
    assert calls["tenant_code"] == "rodol_prod"
    assert calls["environment_code"] == "c8te0u_prod"
    assert calls["method"] == "POST"


def test_queryrest_tool_rejects_missing_environment():
    with pytest.raises(protheus_service.ProtheusServiceError) as exc_info:
        asyncio.run(protheus_service.execute_protheus_tool(
                "QueryRest",
                {"cQuery": "SELECT 1"},
                tenant_id="rodol_prod",
            ))

    assert exc_info.value.status_code == 400
