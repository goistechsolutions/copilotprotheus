import asyncio
import os

import pytest
from fastapi import HTTPException

os.environ.setdefault("JWT_SECRET", "x" * 32)

from app.api import agent_sql_routes
from app.services import gemini_client
from app.services.protheus_service import ProtheusServiceError


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeAsyncClient:
    def __init__(self, response_payload):
        self.response_payload = response_payload
        self.payloads = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, json):
        self.payloads.append(json)
        return FakeResponse(self.response_payload)


def test_sql_generation_does_not_send_protheus_tools_to_gemini(monkeypatch):
    client = FakeAsyncClient({
        "candidates": [{
            "content": {
                "parts": [{"text": "SELECT A1_COD FROM SA1010 A1"}],
            },
        }],
    })
    monkeypatch.setattr(gemini_client, "GEMINI_API_KEY", "fixture-api-key")
    monkeypatch.setattr(gemini_client.httpx, "AsyncClient", lambda **_kwargs: client)

    result = asyncio.run(gemini_client.ask_gemini(
        question="Gere uma consulta de clientes",
        intent="sql_generation",
        context={
            "tenant_id": "tenant_alpha",
            "environment_code": "env_homolog",
        },
        allow_tools=False,
    ))

    assert result == "SELECT A1_COD FROM SA1010 A1"
    assert len(client.payloads) == 1
    assert "tools" not in client.payloads[0]


def test_agent_sql_generator_disables_tools_only_for_gemini(monkeypatch):
    captured = {}

    async def fake_ask_gemini(**kwargs):
        captured.update(kwargs)
        return "SELECT A1_COD FROM SA1010 A1 WHERE A1.D_E_L_E_T_ <> '*'"

    monkeypatch.setattr(agent_sql_routes.settings, "llm_backend", "gemini")
    monkeypatch.setattr(gemini_client, "ask_gemini", fake_ask_gemini)

    result = asyncio.run(agent_sql_routes.real_llm_sql_generator(
        prompt="Liste clientes",
        context_text="SA1010: A1_COD",
        empresa="01",
        filial="0101",
        xfilial="0101",
        tenant_id="tenant_alpha",
        environment_code="env_homolog",
    ))

    assert result == "SELECT A1_COD FROM SA1010 A1 WHERE A1.D_E_L_E_T_ <> '*'"
    assert captured["allow_tools"] is False
    assert captured["context"]["tenant_id"] == "tenant_alpha"
    assert captured["context"]["environment_code"] == "env_homolog"


def test_agent_sql_generator_preserves_protheus_connection_error(monkeypatch):
    async def fake_ask_gemini(**_kwargs):
        raise ProtheusServiceError(
            "conexão REST Protheus ativa não localizada para tenant_alpha/env_homolog",
            status_code=404,
        )

    monkeypatch.setattr(agent_sql_routes.settings, "llm_backend", "gemini")
    monkeypatch.setattr(gemini_client, "ask_gemini", fake_ask_gemini)

    with pytest.raises(HTTPException) as error:
        asyncio.run(agent_sql_routes.real_llm_sql_generator(
            prompt="Liste clientes",
            context_text="SA1010: A1_COD",
            empresa="01",
            filial="0101",
            xfilial="0101",
            tenant_id="tenant_alpha",
            environment_code="env_homolog",
        ))

    assert error.value.status_code == 404
    assert "conexão REST Protheus ativa não localizada" in str(error.value.detail)
    assert "provedor de IA" not in str(error.value.detail)
