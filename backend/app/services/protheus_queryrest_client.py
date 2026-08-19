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


class ProtheusQueryRestClient:
    def __init__(
        self,
        db: Any,
        tenant_code: str,
        environment_code: str = "default",
    ) -> None:
        self.db = db
        self.tenant_code = tenant_code
        self.environment_code = environment_code

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

            response = await self._send(
                url,
                token,
                method,
                query,
                payload,
            )

        if response.status_code >= 400:
            logger.error(
                "QueryRest falhou tenant=%s ambiente=%s status=%s",
                self.tenant_code,
                self.environment_code,
                response.status_code,
            )
            raise ProtheusQueryRestError(
                "Falha na execução do QueryRest Protheus.",
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
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }

        request_payload: dict[str, Any] = dict(payload or {})
        request_payload.setdefault("query", query)

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,
        ) as client:
            if method.upper() == "GET":
                return await client.get(
                    url,
                    headers=headers,
                    params={"query": query},
                )

            return await client.post(
                url,
                headers=headers,
                json=request_payload,
            )
