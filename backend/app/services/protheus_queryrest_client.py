from __future__ import annotations

import json
import logging
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


def _sanitize_protheus_json(raw: str) -> str:
    """Normaliza respostas históricas do Protheus sem expor o conteúdo em logs."""

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
                        if len(hex_sequence) == 4 and all(
                            value in "0123456789abcdefABCDEF" for value in hex_sequence
                        ):
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
    """Extrai a mensagem diagnóstica do AppServer Protheus."""
    try:
        payload = response.json()
        if isinstance(payload, dict):
            for key in ("errorMessage", "message", "detail", "error", "description", "msg", "errorCode", "code", "cQuery", "reason"):
                value = payload.get(key)
                if value:
                    return " ".join(str(value).split())[:500]
    except ValueError:
        pass

    raw_text = response.text.strip()
    if raw_text:
        return " ".join(raw_text.split())[:500]
    return ""


def _parse_queryrest_json(response: httpx.Response) -> Any:
    """Faz parse estrito e depois aplica apenas a normalização conhecida."""

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
    logger.error(
        "QueryRest retornou resposta não JSON status=%s content_type=%s body_length=%s",
        response.status_code,
        content_type,
        len(raw),
    )
    raise ProtheusQueryRestError(
        f"QueryRest retornou conteúdo não JSON (content-type={content_type}, tamanho={len(raw)}).",
        response.status_code,
        raw,
    )


class ProtheusQueryRestError(RuntimeError):
    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


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
            remote_error = _extract_remote_error(response)
            logger.error(
                "QueryRest falhou tenant=%s ambiente=%s status=%s remote_error=%s",
                self.tenant_code,
                self.environment_code,
                response.status_code,
                remote_error or "(sem corpo)",
            )
            detail = f"Falha na execução do QueryRest Protheus (HTTP {response.status_code})."
            if remote_error:
                detail = f"{detail} Mensagem do AppServer: {remote_error}"
            raise ProtheusQueryRestError(detail, response.status_code, response.text)

        return _parse_queryrest_json(response)

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
        correlation_id = get_correlation_id()
        if correlation_id != "-":
            headers["X-Correlation-ID"] = correlation_id

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
            "correlation_id": correlation_id,
        }
        logger.info("queryrest_auth_context %s", safe_auth_debug)

        # O contrato REST Protheus documentado usa exclusivamente cQuery.
        # Porém, a especificação da EliteCorp (PDF) exige o uso da chave 'query'.
        request_payload: dict[str, Any] = dict(payload or {})
        request_payload["query"] = query
        request_payload["cQuery"] = query

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
