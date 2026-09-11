from __future__ import annotations

import json
import logging
import os
import re
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
GENERIC_QUERY_ENDPOINT = "/api/framework/v1/genericQuery"


def _tls_verify_setting() -> bool | str:
    """Mantém TLS verificado; CA corporativa só por configuração explícita."""
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
    """Parser compatível com respostas JSON do AppServer Protheus."""
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
    logger.error("GenericQuery retornou resposta não JSON status=%s content_type=%s body_length=%s", response.status_code, content_type, len(raw))
    raise ProtheusQueryRestError(
        f"GenericQuery retornou conteúdo não JSON (content-type={content_type}, tamanho={len(raw)}).",
        response.status_code,
        raw,
    )


_parse_protheus_json = _parse_queryrest_json


def _split_fields(value: str) -> list[str]:
    result: list[str] = []
    current: list[str] = []
    depth = 0
    for char in value:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            if current:
                result.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        result.append("".join(current).strip())
    return result


def _field_name(expression: str) -> str:
    match = re.match(r"^\s*(?:[A-Za-z][A-Za-z0-9_]*\.)?([A-Za-z][A-Za-z0-9_]*)(?:\s+AS\s+[A-Za-z][A-Za-z0-9_]*)?\s*$", expression, re.IGNORECASE)
    if not match:
        raise ValueError(f"Campo não suportado pela GenericQuery: {expression!r}")
    return match.group(1).upper()


def _generic_query_params(query: str, payload: Mapping[str, Any] | None = None) -> dict[str, Any]:
    explicit = dict(payload or {})
    if explicit.get("Tables") or explicit.get("tables"):
        params = {key: value for key, value in explicit.items() if value is not None}
        params.setdefault("FilialFilter", True)
        params.setdefault("DeletedFilter", True)
        return params

    clean = re.sub(r"\s+", " ", str(query or "")).strip().rstrip(";")
    match = re.match(r"^SELECT\s+(.+?)\s+FROM\s+(.+)$", clean, re.IGNORECASE)
    if not match:
        raise ValueError("GenericQuery requer SELECT com Tables/Fields válidos.")

    fields_text, remainder = match.groups()
    clause_match = re.search(r"\s+(WHERE|GROUP BY|ORDER BY|HAVING|FETCH|OFFSET)\s+", remainder, re.IGNORECASE)
    from_text = remainder[:clause_match.start()].strip() if clause_match else remainder.strip()
    tail = remainder[clause_match.start():].strip() if clause_match else ""

    if re.search(r"\bJOIN\b|,", from_text, re.IGNORECASE):
        raise ValueError("JOINs devem informar Tables, Fields e FromQry explicitamente.")

    table_match = re.match(r"^([A-Za-z][A-Za-z0-9_]*)(?:\s+(?:AS\s+)?([A-Za-z][A-Za-z0-9_]*))?$", from_text, re.IGNORECASE)
    if not table_match:
        raise ValueError(f"Tabela inválida para GenericQuery: {from_text!r}")

    physical, alias = table_match.groups()
    alias = (alias or physical).upper()
    params: dict[str, Any] = {
        "Tables": alias,
        "Fields": ",".join(_field_name(item) for item in _split_fields(fields_text)),
        "FilialFilter": True,
        "DeletedFilter": True,
    }

    if tail.upper().startswith("WHERE "):
        where = tail[6:].strip()
        where = re.sub(r"^\s*(?:AND\s+)?[A-Za-z][A-Za-z0-9_]*\.D_E_L_E_T_\s*<>\s*'\*'\s*", "", where, flags=re.IGNORECASE)
        params["Where"] = re.sub(r"^\s*AND\s+", "", where, flags=re.IGNORECASE).strip()
    elif tail:
        raise ValueError("GROUP BY, ORDER BY e FETCH exigem parâmetros GenericQuery explícitos.")

    logger.info("genericquery_request_built table_alias=%s physical_table=%s field_count=%s has_where=%s", alias, physical.upper(), len(params["Fields"].split(",")), bool(params.get("Where")))
    return params


class ProtheusQueryRestClient:
    """Cliente legado com execução na API padrão TOTVS GenericQuery."""

    def __init__(self, db: Any, tenant_code: str, environment_code: str) -> None:
        self.db = db
        self.tenant_code = str(tenant_code or "").strip()
        self.environment_code = str(environment_code or "").strip()
        if not self.tenant_code:
            raise ValueError("tenant_code é obrigatório para GenericQuery.")
        if not self.environment_code or self.environment_code.lower() in {"default", "none", "null"}:
            raise ValueError("environment_code Protheus é obrigatório e deve ser real.")

    async def execute(self, query: str, *, method: str = "GET", payload: Mapping[str, Any] | None = None) -> Any:
        connection = load_connection(self.db, self.tenant_code, self.environment_code)
        base_url = str(connection["base_rest_url"]).rstrip("/")
        url = f"{base_url}{GENERIC_QUERY_ENDPOINT}"
        token = await get_valid_access_token(self.db, self.tenant_code, self.environment_code)
        if not token:
            raise ProtheusQueryRestError("Access token Protheus vazio após resolução.", 401)

        params = _generic_query_params(query, payload)
        response = await self._send(url, token, params)
        if response.status_code == 401:
            invalidate_access_token(self.db, self.tenant_code, self.environment_code)
            token = await get_valid_access_token(self.db, self.tenant_code, self.environment_code)
            if not token:
                raise ProtheusQueryRestError("Access token Protheus vazio após renovação.", 401)
            response = await self._send(url, token, params)

        if response.status_code == 403:
            raise ProtheusQueryRestError("Protheus recusou a autorização para GenericQuery (HTTP 403).", 403)
        if response.status_code >= 400:
            remote_error = _extract_remote_error(response)
            detail = f"Falha na execução da GenericQuery Protheus (HTTP {response.status_code})."
            if remote_error:
                detail = f"{detail} Mensagem do AppServer: {remote_error}"
            raise ProtheusQueryRestError(detail, response.status_code, response.text)
        return _parse_queryrest_json(response)

    async def _send(self, url: str, access_token: str, params: Mapping[str, Any]) -> httpx.Response:
        headers = require_bearer_headers({
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        })
        correlation_id = get_correlation_id()
        if correlation_id != "-":
            headers["X-Correlation-ID"] = correlation_id

        logger.info(
            "genericquery_auth_context tenant=%s environment=%s auth_header_present=%s correlation_id=%s tables=%s field_count=%s",
            self.tenant_code,
            self.environment_code,
            bool(headers.get("Authorization")),
            correlation_id,
            params.get("Tables"),
            len(str(params.get("Fields", "")).split(",")),
        )

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=False, verify=_tls_verify_setting()) as client:
            try:
                return await client.get(url, headers=headers, params=params)
            except httpx.RequestError as exc:
                logger.exception("Falha de rede ao acessar GenericQuery: %s", type(exc).__name__)
                raise ProtheusQueryRestError("Erro de comunicação com o Protheus na execução da GenericQuery.", 502) from exc
