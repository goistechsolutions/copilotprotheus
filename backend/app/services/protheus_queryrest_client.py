from __future__ import annotations

import json
import logging
import os
from typing import Any, Mapping

import httpx

from app.core.logging_config import get_correlation_id
from app.services.protheus_token_service import (
    get_valid_access_token,
    invalidate_access_token,
    load_connection,
)

logger = logging.getLogger(__name__)
REQUEST_TIMEOUT_SECONDS = 60
QUERYREST_ENDPOINT = "/queryrest"


def _tls_verify_setting() -> bool | str:
    """Mantém TLS verificado; permite CA corporativa por configuração explícita."""
    ca_bundle = os.getenv("PROTHEUS_CA_BUNDLE", "").strip()
    if ca_bundle:
        return ca_bundle
    return os.getenv("PROTHEUS_VERIFY_TLS", "true").strip().lower() not in {"0", "false", "no", "off"}


class ProtheusQueryRestError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, response_body: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


def _sanitize_protheus_json(raw: str) -> str:
    if not raw:
        return ""
    valid_escapes = set('"\\/bfnrtu')
    output: list[str] = []
    index = 0
    inside_string = False
    while index < len(raw):
        char = raw[index]
        if inside_string:
            if char == "\\":
                if index + 1 >= len(raw):
                    index += 1
                    continue
                next_char = raw[index + 1]
                if next_char in valid_escapes:
                    output.extend((char, next_char))
                    if next_char == "u":
                        hex_sequence = raw[index + 2:index + 6]
                        if len(hex_sequence) == 4 and all(value in "0123456789abcdefABCDEF" for value in hex_sequence):
                            output.append(hex_sequence)
                            index += 6
                            continue
                        output[-2:] = [" "]
                    index += 2
                    continue
                output.append(next_char)
                index += 2
                continue
            if char == '"':
                inside_string = False
                output.append(char)
                index += 1
                continue
            if ord(char) < 0x20:
                output.append({"\n": "\\n", "\r": "\\r", "\t": "\\t"}.get(char, f"\\u{ord(char):04x}"))
                index += 1
                continue
            output.append(char)
            index += 1
            continue
        if char == '"':
            inside_string = True
        output.append(char)
        index += 1
    return "".join(output).lstrip("\ufeff")


def _extract_remote_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            for key in ("errorMessage", "message", "detail", "error", "description", "msg", "errorCode", "code", "reason"):
                value = payload.get(key)
                if value:
                    return " ".join(str(value).split())[:500]
    except ValueError:
        pass
    return " ".join(response.text.strip().split())[:500]


def _parse_queryrest_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        pass

    encoding = response.encoding or "utf-8-sig"
    raw = response.content.decode(encoding, errors="replace").lstrip("\ufeff")
    for candidate in (raw, _sanitize_protheus_json(raw)):
        try:
            return json.loads(candidate)
        except ValueError:
            continue

    content_type = response.headers.get("content-type", "unknown").split(";", 1)[0].strip()
    logger.error("QueryRest retornou resposta não JSON status=%s content_type=%s body_length=%s", response.status_code, content_type, len(raw))
    raise ProtheusQueryRestError(
        f"QueryRest retornou conteúdo não JSON (content-type={content_type}, tamanho={len(raw)}).",
        response.status_code,
        raw,
    )


_parse_protheus_json = _parse_queryrest_json


def require_bearer_headers(headers: dict[str, str]) -> dict[str, str]:
    authorization = headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise RuntimeError("Requisição Protheus sem Authorization Bearer.")
    if not authorization.removeprefix("Bearer ").strip():
        raise RuntimeError("Requisição Protheus com Bearer vazio.")
    return headers


class ProtheusQueryRestClient:
    """Cliente da API customizada compilada no Protheus em /queryrest."""

    def __init__(self, db: Any, tenant_code: str, environment_code: str) -> None:
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
        connection = load_connection(self.db, self.tenant_code, self.environment_code)
        base_url = str(connection["base_rest_url"]).rstrip("/")
        url = f"{base_url}{QUERYREST_ENDPOINT}"
        token = await get_valid_access_token(self.db, self.tenant_code, self.environment_code)
        if not token:
            raise ProtheusQueryRestError("Access token Protheus vazio após resolução.", 401)

        response = await self._send(url, token, query, method=method, payload=payload)
        if response.status_code == 401:
            logger.warning("QueryRest retornou 401; renovando token tenant=%s ambiente=%s", self.tenant_code, self.environment_code)
            invalidate_access_token(self.db, self.tenant_code, self.environment_code)
            token = await get_valid_access_token(self.db, self.tenant_code, self.environment_code)
            if not token:
                raise ProtheusQueryRestError("Access token Protheus vazio após renovação.", 401)
            response = await self._send(url, token, query, method=method, payload=payload)

        if response.status_code >= 400:
            remote_error = _extract_remote_error(response)
            detail = f"Falha na execução do QueryRest Protheus (HTTP {response.status_code})."
            if remote_error:
                detail = f"{detail} Mensagem do AppServer: {remote_error}"
            raise ProtheusQueryRestError(detail, response.status_code, response.text[:500])
        return _parse_queryrest_json(response)

    async def _send(
        self,
        url: str,
        access_token: str,
        query: str,
        *,
        method: str,
        payload: Mapping[str, Any] | None,
    ) -> httpx.Response:
        headers = require_bearer_headers({
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        })
        correlation_id = get_correlation_id()
        if correlation_id != "-":
            headers["X-Correlation-ID"] = correlation_id

        logger.info(
            "queryrest_auth_context tenant=%s environment=%s auth_header_present=%s auth_scheme=Bearer correlation_id=%s method=%s",
            self.tenant_code,
            self.environment_code,
            True,
            correlation_id,
            method.upper(),
        )

        request_method = method.upper()
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,
            verify=_tls_verify_setting(),
        ) as client:
            try:
                if request_method == "GET":
                    return await client.get(
                        url,
                        headers=headers,
                        params={"cquery": query},
                    )

                form_data = dict(payload or {})
                form_data.pop("query", None)
                form_data.pop("cQuery", None)
                form_data["_queryparam"] = query
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                return await client.post(
                    url,
                    headers=headers,
                    data=form_data,
                )
            except httpx.RequestError as exc:
                logger.exception("Falha de rede ao acessar QueryRest: %s", type(exc).__name__)
                raise ProtheusQueryRestError("Erro de comunicação com o Protheus na execução do QueryRest.", 502) from exc
