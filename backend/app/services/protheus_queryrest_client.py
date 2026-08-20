from __future__ import annotations

import logging
from typing import Any, Mapping

import httpx

from app.services.protheus_token_service import (
    get_valid_access_token,
    invalidate_access_token,
    load_connection,
)

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 60


class ProtheusQueryRestError(RuntimeError):
    def __init__(
        self,
        message: str,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code


def require_bearer_headers(headers: dict[str, str]) -> dict[str, str]:
    authorization = headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise RuntimeError("Requisição Protheus sem Authorization Bearer.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise RuntimeError("Requisição Protheus com Bearer vazio.")
    return headers


class ProtheusQueryRestClient:
    def __init__(
        self,
        db: Any,
        tenant_code: str,
        environment_code: str,
    ) -> None:
        self.db = db
        self.tenant_code = str(tenant_code or "").strip()
        self.environment_code = str(environment_code or "").strip()
        if not self.tenant_code:
            raise ValueError("tenant_code é obrigatório para QueryRest.")
        if not self.environment_code or self.environment_code.lower() in {"default", "none", "null"}:
            raise ValueError("environment_code Protheus é obrigatório e deve ser real.")

    async def execute(
        self,
        query: str,
        *,
        method: str = "POST",
        payload: Mapping[str, Any] | None = None,
    ) -> Any:
        connection = load_connection(
            self.db,
            self.tenant_code,
            self.environment_code,
        )

        base_url = str(connection["base_rest_url"]).rstrip("/")
        url = f"{base_url}/QueryRest"

        token = await get_valid_access_token(
            self.db,
            self.tenant_code,
            self.environment_code,
        )

        if not token:
            raise ProtheusQueryRestError(
                "Access token Protheus vazio após resolução.",
                status_code=401,
            )

        response = await self._send(
            url,
            token,
            method,
            query,
            payload,
        )

        if response.status_code == 401:
            logger.warning(
                "QueryRest retornou 401; renovando token "
                "tenant=%s ambiente=%s",
                self.tenant_code,
                self.environment_code,
            )

            invalidate_access_token(
                self.db,
                self.tenant_code,
                self.environment_code,
            )

            token = await get_valid_access_token(
                self.db,
                self.tenant_code,
                self.environment_code,
            )

            if not token:
                raise ProtheusQueryRestError(
                    "Access token Protheus vazio após renovação.",
                    status_code=401,
                )

            response = await self._send(
                url,
                token,
                method,
                query,
                payload,
            )

        if response.status_code == 403:
            logger.error(
                "QueryRest 403 Forbidden tenant=%s ambiente=%s",
                self.tenant_code,
                self.environment_code,
            )
            raise ProtheusQueryRestError(
                "Protheus recusou a autorização para QueryRest (HTTP 403). "
                "Confirme permissões do usuário REST no Protheus e o header Bearer.",
                status_code=403,
            )

        if response.status_code >= 400:
            logger.error(
                "QueryRest falhou tenant=%s ambiente=%s status=%s body=%s",
                self.tenant_code,
                self.environment_code,
                response.status_code,
                response.text[:200],
            )
            raise ProtheusQueryRestError(
                f"Falha na execução do QueryRest Protheus (HTTP {response.status_code}).",
                response.status_code,
            )

        try:
            return response.json()
        except ValueError as exc:
            raise ProtheusQueryRestError(
                "QueryRest retornou conteúdo que não é JSON.",
                response.status_code,
            ) from exc

    async def _send(
        self,
        url: str,
        access_token: str,
        method: str,
        query: str,
        payload: Mapping[str, Any] | None,
    ) -> httpx.Response:
        headers = require_bearer_headers({
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        })

        safe_auth_debug = {
            "tenant_code": self.tenant_code,
            "environment_code": self.environment_code,
            "url": url,
            "auth_header_present": bool(headers.get("Authorization")),
            "auth_scheme": (
                headers.get("Authorization", "").split(" ", 1)[0]
                if headers.get("Authorization")
                else None
            ),
            "token_length": len(access_token) if access_token else 0,
        }
        logger.info("queryrest_auth_context %s", safe_auth_debug)

        request_payload: dict[str, Any] = dict(payload or {})
        request_payload.setdefault("query", query)
        request_payload.setdefault("cQuery", query)

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,
            verify=False,
        ) as client:
            if method.upper() == "GET":
                return await client.get(
                    url,
                    headers=headers,
                    params={"cQuery": query, "query": query},
                )

            return await client.post(
                url,
                headers=headers,
                json=request_payload,
            )
