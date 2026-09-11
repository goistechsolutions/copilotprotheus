from __future__ import annotations

import json
import logging
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

_GENERIC_QUERY_ENDPOINT = "/api/framework/v1/genericQuery"
_SQL_TABLE_ALIAS_RE = re.compile(
    r"^\s*([A-Za-z][A-Za-z0-9_]*)"
    r"(?:\s+(?:AS\s+)?([A-Za-z][A-Za-z0-9_]*))?\s*$",
    re.IGNORECASE,
)
_SQL_FIELD_RE = re.compile(
    r"^\s*(?:(?P<alias>[A-Za-z][A-Za-z0-9_]*)\.)?"
    r"(?P<field>[A-Za-z][A-Za-z0-9_]*)"
    r"(?:\s+AS\s+(?P<output>[A-Za-z][A-Za-z0-9_]*))?\s*$",
    re.IGNORECASE,
)


class ProtheusQueryRestError(RuntimeError):
    """Mantido por compatibilidade com os chamadores existentes."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
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
                        if len(hex_sequence) == 4 and all(
                            value in "0123456789abcdefABCDEF"
                            for value in hex_sequence
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
                output.append(
                    {"\n": "\\n", "\r": "\\r", "\t": "\\t"}.get(
                        char,
                        f"\\u{ord(char):04x}",
                    )
                )
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
            for key in (
                "errorMessage",
                "message",
                "detail",
                "error",
                "description",
                "msg",
                "errorCode",
                "code",
                "reason",
            ):
                value = payload.get(key)
                if value:
                    return " ".join(str(value).split())[:500]
    except ValueError:
        pass

    raw_text = response.text.strip()
    return " ".join(raw_text.split())[:500] if raw_text else ""


def _parse_protheus_json(response: httpx.Response) -> Any:
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

    content_type = response.headers.get(
        "content-type",
        "unknown",
    ).split(";", 1)[0].strip()

    logger.error(
        "GenericQuery retornou resposta não JSON "
        "status=%s content_type=%s body_length=%s",
        response.status_code,
        content_type,
        len(raw),
    )

    raise ProtheusQueryRestError(
        "GenericQuery retornou conteúdo não JSON "
        f"(content-type={content_type}, tamanho={len(raw)}).",
        response.status_code,
        raw,
    )


def require_bearer_headers(headers: dict[str, str]) -> dict[str, str]:
    authorization = headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        raise RuntimeError("Requisição Protheus sem Authorization Bearer.")

    token = authorization.removeprefix("Bearer ").strip()

    if not token:
        raise RuntimeError("Requisição Protheus com Bearer vazio.")

    return headers


def _split_select_fields(select_clause: str) -> list[str]:
    """Divide campos do SELECT sem quebrar expressões com parênteses."""

    fields: list[str] = []
    current: list[str] = []
    depth = 0

    for char in select_clause:
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1

        if char == "," and depth == 0:
            item = "".join(current).strip()
            if item:
                fields.append(item)
            current = []
            continue

        current.append(char)

    item = "".join(current).strip()
    if item:
        fields.append(item)

    return fields


def _find_clause_index(value: str, clauses: tuple[str, ...]) -> int:
    upper_value = value.upper()
    matches = [upper_value.find(clause) for clause in clauses]
    matches = [index for index in matches if index >= 0]
    return min(matches) if matches else len(value)


def _remove_table_qualifier(field_expression: str) -> str:
    """
    GenericQuery recebe campos simples para consultas sem FromQry.
    Ex.: SF2.F2_DOC AS NUMERO -> F2_DOC.
    """

    match = _SQL_FIELD_RE.match(field_expression)

    if not match:
        raise ValueError(
            "GenericQuery não suporta expressão de campo complexa "
            f"na consulta simples: {field_expression!r}."
        )

    return match.group("field").upper()


def _extract_alias_table(table_expression: str) -> tuple[str, str]:
    """
    Retorna nome físico e alias SQL.

    Exemplo:
      SF2010 SF2 -> ("SF2010", "SF2")
      SF2        -> ("SF2", "SF2")
    """

    match = _SQL_TABLE_ALIAS_RE.match(table_expression)

    if not match:
        raise ValueError(
            "Não foi possível interpretar a tabela do SQL para GenericQuery: "
            f"{table_expression!r}."
        )

    physical_name = match.group(1).upper()
    sql_alias = (match.group(2) or physical_name).upper()

    return physical_name, sql_alias


def _generic_query_params_from_sql(
    query: str,
    payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Converte SELECT simples em parâmetros GenericQuery.

    Restrições intencionais:
    - Uma única tabela sem JOIN usa Tables/Fields/Where;
    - JOIN exige FromQry explícito fornecido pelo chamador;
    - Não envia aliases de tabela em Fields;
    - Não replica manualmente exclusão lógica nem filial quando os filtros
      nativos FilialFilter e DeletedFilter estiverem ativos.
    """

    explicit = dict(payload or {})

    if explicit.get("Tables") or explicit.get("tables"):
        params = {
            key: value
            for key, value in explicit.items()
            if value is not None
        }
        params.setdefault("FilialFilter", True)
        params.setdefault("DeletedFilter", True)
        return params

    clean_query = re.sub(r"\s+", " ", str(query or "")).strip().rstrip(";")

    select_match = re.match(
        r"^SELECT\s+(?P<fields>.+?)\s+FROM\s+(?P<rest>.+)$",
        clean_query,
        flags=re.IGNORECASE,
    )

    if not select_match:
        raise ValueError(
            "A GenericQuery requer um SELECT simples ou parâmetros "
            "Tables/Fields explícitos."
        )

    select_fields = select_match.group("fields").strip()
    from_and_after = select_match.group("rest").strip()

    clause_index = _find_clause_index(
        from_and_after,
        (" WHERE ", " GROUP BY ", " ORDER BY ", " HAVING ", " FETCH ", " OFFSET "),
    )

    from_clause = from_and_after[:clause_index].strip()
    trailing_clause = from_and_after[clause_index:].strip()

    if re.search(r"\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b", from_clause, re.IGNORECASE):
        raise ValueError(
            "Consulta com JOIN não pode ser convertida automaticamente para "
            "GenericQuery. Informe Tables, Fields e FromQry explicitamente."
        )

    if "," in from_clause:
        raise ValueError(
            "Consulta com múltiplas tabelas não pode ser convertida "
            "automaticamente para GenericQuery."
        )

    physical_name, sql_alias = _extract_alias_table(from_clause)
    fields = [_remove_table_qualifier(field) for field in _split_select_fields(select_fields)]

    where_clause = ""
    if trailing_clause.upper().startswith("WHERE "):
        where_clause = trailing_clause[6:].strip()
    elif trailing_clause:
        raise ValueError(
            "GenericQuery automático aceita somente WHERE após FROM. "
            "GROUP BY, ORDER BY, FETCH e OFFSET devem ser modelados "
            "explicitamente no adaptador."
        )

    if where_clause:
        # GenericQuery já aplica a filial e exclusão lógica quando os filtros
        # nativos estão ativos. Evita duplicação e referências desnecessárias.
        where_clause = re.sub(
            rf"\s*(?:AND\s+)?{re.escape(sql_alias)}\.D_E_L_E_T_\s*<>\s*'\*'",
            "",
            where_clause,
            flags=re.IGNORECASE,
        )
        where_clause = re.sub(
            rf"\s*(?:AND\s+)?{re.escape(sql_alias)}\.F2_FILIAL\s*=\s*'[^']*'",
            "",
            where_clause,
            flags=re.IGNORECASE,
        )
        where_clause = re.sub(r"^\s*AND\s+", "", where_clause, flags=re.IGNORECASE)
        where_clause = where_clause.strip()

    params: dict[str, Any] = {
        # Para GenericQuery simples, Tables deve receber o alias SX2.
        # No contexto atual SF2010 é a tabela física do alias SF2.
        "Tables": sql_alias,
        "Fields": ",".join(fields),
        "FilialFilter": True,
        "DeletedFilter": True,
    }

    if where_clause:
        params["Where"] = where_clause

    logger.info(
        "genericquery_request_built table_alias=%s physical_table=%s "
        "field_count=%s has_where=%s",
        sql_alias,
        physical_name,
        len(fields),
        bool(where_clause),
    )

    return params


class ProtheusQueryRestClient:
    """
    Cliente mantido com nome legado para compatibilidade.
    A execução usa a API padrão TOTVS GenericQuery.
    """

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
            raise ValueError("tenant_code é obrigatório para GenericQuery.")

        if (
            not self.environment_code
            or self.environment_code.lower() in {"default", "none", "null"}
        ):
            raise ValueError(
                "environment_code Protheus é obrigatório e deve ser real."
            )

    async def execute(
        self,
        query: str,
        *,
        method: str = "GET",
        payload: Mapping[str, Any] | None = None,
    ) -> Any:
        connection = load_connection(
            self.db,
            self.tenant_code,
            self.environment_code,
        )

        base_url = str(connection["base_rest_url"]).rstrip("/")
        url = f"{base_url}{_GENERIC_QUERY_ENDPOINT}"

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

        params = _generic_query_params_from_sql(query, payload)
        response = await self._send(url, token, params)

        if response.status_code == 401:
            logger.warning(
                "GenericQuery retornou 401; renovando token "
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

            response = await self._send(url, token, params)

        if response.status_code == 403:
            logger.error(
                "GenericQuery 403 Forbidden tenant=%s ambiente=%s",
                self.tenant_code,
                self.environment_code,
            )
            raise ProtheusQueryRestError(
                "Protheus recusou a autorização para GenericQuery (HTTP 403). "
                "Confirme permissões REST, SECURITY=1 e o Bearer token.",
                status_code=403,
            )

        if response.status_code >= 400:
            remote_error = _extract_remote_error(response)

            logger.error(
                "GenericQuery falhou tenant=%s ambiente=%s status=%s remote_error=%s",
                self.tenant_code,
                self.environment_code,
                response.status_code,
                remote_error or "(sem corpo)",
            )

            detail = (
                f"Falha na execução da GenericQuery Protheus "
                f"(HTTP {response.status_code})."
            )

            if remote_error:
                detail = f"{detail} Mensagem do AppServer: {remote_error}"

            raise ProtheusQueryRestError(
                detail,
                response.status_code,
                response.text,
            )

        return _parse_protheus_json(response)

    async def _send(
        self,
        url: str,
        access_token: str,
        params: Mapping[str, Any],
    ) -> httpx.Response:
        headers = require_bearer_headers({
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        })

        correlation_id = get_correlation_id()
        if correlation_id != "-":
            headers["X-Correlation-ID"] = correlation_id

        logger.info(
            "genericquery_auth_context tenant=%s environment=%s "
            "auth_header_present=%s auth_scheme=%s token_length=%s "
            "correlation_id=%s tables=%s field_count=%s",
            self.tenant_code,
            self.environment_code,
            bool(headers.get("Authorization")),
            headers.get("Authorization", "").split(" ", 1)[0],
            len(access_token),
            correlation_id,
            params.get("Tables") or params.get("tables"),
            len(str(params.get("Fields") or params.get("fields") or "").split(",")),
        )

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,
            verify=False,
        ) as client:
            try:
                return await client.get(
                    url,
                    headers=headers,
                    params=params,
                )
            except httpx.RequestError as exc:
                logger.exception(
                    "Falha de rede ao acessar GenericQuery: %s",
                    type(exc).__name__,
                )
                raise ProtheusQueryRestError(
                    message=(
                        "Erro de comunicação com o Protheus na execução "
                        "da GenericQuery (timeout ou conexão recusada)."
                    ),
                    status_code=502,
                ) from exc
