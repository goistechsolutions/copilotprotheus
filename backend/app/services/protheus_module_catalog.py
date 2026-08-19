from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from sqlalchemy import text

_SCHEMA_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_RESERVED_SCHEMAS = {"public", "pg_catalog", "information_schema"}


def quote_tenant_schema(schema_name: str) -> str:
    value = str(schema_name or "").strip().lower()

    if not _SCHEMA_PATTERN.fullmatch(value):
        raise ValueError("schema de tenant inválido")

    if value in _RESERVED_SCHEMAS:
        raise ValueError("schema de tenant reservado")

    return f'"{value}"'


def normalize_module_token(value: str | int | None) -> str | None:
    if value is None:
        return None

    token = str(value).strip().upper()

    if not token:
        return None

    token = re.sub(r"\s+", " ", token)

    if token.startswith("SIGA"):
        token = token[4:]

    return token


def resolve_global_module(
    db: Any,
    module: str | int | None,
) -> Mapping[str, Any] | None:
    token = normalize_module_token(module)

    if not token:
        return None

    if token.isdigit():
        row = db.execute(
            text("""
                SELECT
                    mod_code,
                    mod_sigla,
                    mod_name
                FROM public.protheus_modules_master
                WHERE mod_code = :mod_code
                  AND active = TRUE
                LIMIT 1
            """),
            {"mod_code": int(token)},
        ).mappings().first()

        return dict(row) if row else None

    row = db.execute(
        text("""
            SELECT
                mod_code,
                mod_sigla,
                mod_name
            FROM public.protheus_modules_master
            WHERE active = TRUE
              AND (
                    UPPER(TRIM(mod_sigla)) = :token
                 OR UPPER(TRIM(mod_sigla)) = 'SIGA' || :token
                 OR UPPER(COALESCE(mod_name, '')) LIKE '%' || :token || '%'
              )
            ORDER BY mod_code
            LIMIT 1
        """),
        {"token": token},
    ).mappings().first()

    return dict(row) if row else None


def resolve_tenant_module_codes(
    db: Any,
    tenant_schema: str,
    module: str | int | None,
) -> list[str]:
    resolved = resolve_global_module(db, module)

    if not resolved:
        return []

    schema = quote_tenant_schema(tenant_schema)

    rows = db.execute(
        text(f"""
            SELECT DISTINCT
                mod_code::text AS module_code
            FROM {schema}.tenant_schemas
            WHERE mod_code = :mod_code
        """),
        {"mod_code": resolved["mod_code"]},
    ).mappings().all()

    return [str(row["module_code"]) for row in rows]


def require_tenant_module(
    db: Any,
    tenant_schema: str,
    module: str | int | None,
) -> Mapping[str, Any]:
    resolved = resolve_global_module(db, module)

    if not resolved:
        raise ValueError(
            "Módulo não localizado no catálogo global do Protheus."
        )

    allowed_codes = resolve_tenant_module_codes(
        db,
        tenant_schema,
        resolved["mod_code"],
    )

    if not allowed_codes:
        raise ValueError(
            "Módulo não permitido para o tenant informado."
        )

    return {
        "mod_code": str(resolved["mod_code"]),
        "mod_sigla": resolved["mod_sigla"],
        "mod_name": resolved.get("mod_name"),
    }


def filter_allowed_dictionary_tables(
    db: Any,
    tenant_schema: str,
    module_codes: Sequence[str],
    company_id: int | None = None,
) -> list[dict[str, Any]]:
    if not module_codes:
        return []

    schema = quote_tenant_schema(tenant_schema)

    params: dict[str, Any] = {
        "module_codes": list(module_codes),
    }

    company_filter = ""

    if company_id is not None:
        company_filter = """
            AND (
                dt.company_id = :company_id
                OR dt.company_id IS NULL
            )
        """
        params["company_id"] = int(company_id)

    rows = db.execute(
        text(f"""
            SELECT DISTINCT
                dt.table_code,
                dt.table_name,
                dt.module_code,
                COALESCE(dt.description, dt.table_name) AS description
            FROM {schema}.dictionary_tables dt
            JOIN {schema}.tenant_schemas ts
              ON ts.chave = dt.table_code
             AND ts.tabela = dt.table_name
             AND ts.mod_code::text = dt.module_code
            WHERE dt.module_code = ANY(:module_codes)
              {company_filter}
            ORDER BY dt.table_code
        """),
        params,
    ).mappings().all()

    return [dict(row) for row in rows]
