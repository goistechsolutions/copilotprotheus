"""Fachada única para integração REST do Protheus.

A conexão operacional é resolvida exclusivamente por
``tenant_code + environment_code`` em ``public.protheus_rest_connections``.
Consultas QueryRest são delegadas ao cliente OAuth2 central, que controla
Bearer, renovação única após 401 e isolamento da conexão.
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Mapping

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.services.protheus_queryrest_client import (
    ProtheusQueryRestClient,
    ProtheusQueryRestError,
)
from app.services.protheus_token_service import (
    ProtheusAuthError,
    get_valid_access_token,
    load_connection,
)

logger = logging.getLogger("app.protheus")


class ProtheusServiceError(RuntimeError):
    """Erro de integração sem conteúdo sensível da resposta externa."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _require_context(tenant_code: str, environment_code: str | None) -> tuple[str, str]:
    tenant = str(tenant_code or "").strip()
    environment = str(environment_code or "").strip()

    if not tenant:
        raise ProtheusServiceError("tenant_code é obrigatório.", status_code=400)
    if not environment or environment.lower() in {"default", "none", "null"}:
        raise ProtheusServiceError(
            "environment_code Protheus é obrigatório e deve ser real.",
            status_code=400,
        )
    return tenant, environment


def _public_db_session() -> Session:
    """Abre uma sessão no schema público, onde ficam as conexões OAuth2."""

    return SessionLocal()


def get_tenant_config(tenant_code: str, environment_code: str) -> dict[str, Any]:
    """Retorna somente metadados não sensíveis da conexão solicitada.

    A função mantém o nome histórico para compatibilidade de importação, mas
    não consulta mais ``company_info``, ``tenant`` ou variáveis de ambiente.
    Senhas e tokens nunca fazem parte do retorno.
    """

    tenant, environment = _require_context(tenant_code, environment_code)
    db = _public_db_session()
    try:
        try:
            connection = load_connection(db, tenant, environment)
        except ValueError as exc:
            raise ProtheusServiceError(str(exc), status_code=404) from exc

        return {
            "tenant_code": tenant,
            "environment_code": environment,
            "rest_url": str(connection["base_rest_url"]).rstrip("/"),
            "auth_mode": connection["auth_mode"],
            "user": connection["protheus_username"],
            "webapp_url": "",
            "vscode_server_url": "",
        }
    finally:
        db.close()


async def get_protheus_token(tenant_code: str, environment_code: str) -> str:
    """Obtém token válido pelo serviço OAuth2 centralizado."""

    tenant, environment = _require_context(tenant_code, environment_code)
    db = _public_db_session()
    try:
        try:
            return await get_valid_access_token(db, tenant, environment)
        except ProtheusAuthError:
            raise
        except ValueError as exc:
            raise ProtheusServiceError(str(exc), status_code=404) from exc
    finally:
        db.close()


async def build_protheus_headers(
    tenant_code: str,
    config: Mapping[str, Any] | None = None,
    environment_code: str | None = None,
) -> dict[str, str]:
    """Monta headers Bearer para endpoints não-QueryRest.

    O token sempre vem da conexão persistida pelo par exato tenant/ambiente;
    ``config`` é aceito apenas como compatibilidade de assinatura e não pode
    fornecer credenciais, URL alternativa ou token dinâmico.
    """

    configured_environment = (
        environment_code
        or (config or {}).get("environment_code")
    )
    tenant, environment = _require_context(tenant_code, configured_environment)
    token = await get_protheus_token(tenant, environment)
    if not token:
        raise ProtheusServiceError(
            "Access token Protheus vazio após resolução.",
            status_code=401,
        )
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _sanitize_response_text(value: str) -> str:
    """Remove controles de texto sem registrar ou ampliar conteúdo sensível."""

    if not value:
        return value
    return "".join(char if ord(char) >= 32 or char in "\n\r\t" else " " for char in value)


async def _execute_http_get_with_retry(
    url: str,
    params: Mapping[str, Any],
    headers: Mapping[str, str],
) -> str:
    """Executa endpoint REST auxiliar sem transportar credenciais próprias."""

    async with httpx.AsyncClient(
        timeout=settings.timeout_seconds,
        follow_redirects=False,
    ) as client:
        response = await client.get(url, params=dict(params), headers=dict(headers))
        response.raise_for_status()
        return _sanitize_response_text(response.text)


async def _execute_http_post_with_retry(
    url: str,
    json_data: Mapping[str, Any],
    headers: Mapping[str, str],
) -> str:
    """Executa endpoint REST auxiliar com headers Bearer já resolvidos."""

    async with httpx.AsyncClient(
        timeout=settings.timeout_seconds,
        follow_redirects=False,
    ) as client:
        response = await client.post(
            url,
            json=dict(json_data),
            headers=dict(headers),
        )
        response.raise_for_status()
        return _sanitize_response_text(response.text)


async def execute_queryrest(
    db: Session,
    tenant_code: str,
    environment_code: str,
    query: str,
    *,
    method: str = "POST",
    payload: Mapping[str, Any] | None = None,
) -> Any:
    """Executa SQL Oracle no QueryRest por meio do cliente OAuth2 central."""

    tenant, environment = _require_context(tenant_code, environment_code)
    client = ProtheusQueryRestClient(
        db=db,
        tenant_code=tenant,
        environment_code=environment,
    )
    try:
        return await client.execute(
            query,
            method=method,
            payload=payload,
        )
    except ProtheusQueryRestError as exc:
        raise ProtheusServiceError(str(exc), status_code=exc.status_code) from exc


async def descobrir_apis_protheus(palavra_chave: str) -> str:
    """Pesquisa somente o catálogo local de endpoints, sem acessar credenciais."""

    cache_path = Path(__file__).with_name("endpoints_cache.json")
    if not cache_path.exists():
        return json.dumps({"error": "Cache de endpoints não encontrado."}, ensure_ascii=False)

    try:
        endpoints = json.loads(cache_path.read_text(encoding="utf-8"))
        term = str(palavra_chave or "").strip().lower()
        results = []
        for endpoint in endpoints:
            endpoint_path = str(endpoint.get("endpoint", "")).lower()
            if term in endpoint_path:
                results.append(
                    {
                        "endpoint": endpoint.get("endpoint"),
                        "methods": [
                            method.get("method")
                            for method in endpoint.get("methods", [])
                        ],
                    }
                )
            if len(results) >= 15:
                break
        if not results:
            return json.dumps(
                {"message": f"Nenhuma API encontrada para o termo '{term}'"},
                ensure_ascii=False,
            )
        return json.dumps(results, ensure_ascii=False)
    except (OSError, ValueError, TypeError) as exc:
        logger.error("Falha ao ler catálogo local de endpoints: %s", type(exc).__name__)
        return json.dumps({"error": "Falha ao ler o catálogo local de endpoints."}, ensure_ascii=False)


def _extract_environment(
    environment_code: str | None,
    context: Mapping[str, Any] | None,
) -> str | None:
    return environment_code or (context or {}).get("environment_code")


def _extract_query(query_params: Mapping[str, Any]) -> str:
    query = (
        query_params.get("cQuery")
        or query_params.get("query")
        or query_params.get("cquery")
    )
    if not isinstance(query, str) or not query.strip():
        raise ProtheusServiceError(
            "QueryRest exige cQuery ou query não vazio.",
            status_code=400,
        )
    return query.strip()


async def execute_protheus_tool(
    endpoint: str,
    query_params: Mapping[str, Any] | None,
    *,
    tenant_id: str,
    context: Mapping[str, Any] | None = None,
    environment_code: str | None = None,
) -> str:
    """Executa uma ferramenta Protheus com contexto explícito.

    QueryRest é sempre delegado ao cliente OAuth2 central. Endpoints auxiliares
    usam a mesma conexão e o mesmo token, sem aceitar senha/token no contexto.
    """

    environment = _extract_environment(environment_code, context)
    tenant, environment = _require_context(tenant_id, environment)
    params = dict(query_params or {})
    endpoint_name = str(endpoint or "").strip().strip("/")

    if endpoint_name.lower() == "queryrest":
        query = _extract_query(params)
        db = _public_db_session()
        try:
            result = await execute_queryrest(
                db,
                tenant,
                environment,
                query,
                method="POST",
                payload=params,
            )
            return json.dumps(result, ensure_ascii=False, default=str)
        except ProtheusServiceError as exc:
            logger.warning(
                "QueryRest falhou tenant=%s ambiente=%s status=%s",
                tenant,
                environment,
                exc.status_code,
            )
            return json.dumps(
                {
                    "error": str(exc),
                    "status_code": exc.status_code,
                },
                ensure_ascii=False,
            )
        finally:
            db.close()

    config = get_tenant_config(tenant, environment)
    base_url = config["rest_url"]
    url = f"{base_url}/{endpoint_name}"
    headers = await build_protheus_headers(
        tenant,
        config,
        environment_code=environment,
    )

    try:
        return await _execute_http_post_with_retry(url, params, headers)
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Endpoint Protheus falhou tenant=%s ambiente=%s status=%s",
            tenant,
            environment,
            exc.response.status_code,
        )
        return json.dumps(
            {
                "error": f"Falha no endpoint Protheus (HTTP {exc.response.status_code}).",
                "status_code": exc.response.status_code,
            },
            ensure_ascii=False,
        )
    except httpx.RequestError:
        logger.warning(
            "Endpoint Protheus indisponível tenant=%s ambiente=%s",
            tenant,
            environment,
        )
        return json.dumps(
            {
                "error": "Endpoint Protheus indisponível.",
                "status_code": 504,
            },
            ensure_ascii=False,
        )
