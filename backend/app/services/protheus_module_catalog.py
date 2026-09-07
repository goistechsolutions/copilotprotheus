from __future__ import annotations

import re
from typing import Any, Iterable, Sequence


_COLUMN_CACHE: dict[tuple[str, str], set[str]] = {}

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
                module_code::text AS module_code
            FROM {schema}.dictionary_tables
            WHERE tenant_id = :tenant_id
              AND module_code::text = CAST(:mod_code AS text)
              AND COALESCE(active_flag, TRUE) = TRUE
        """),
        {"tenant_id": str(tenant_schema), "mod_code": str(resolved["mod_code"])},
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


def _available_columns(db: Any, schema_name: str, table_name: str) -> set[str]:
    cache_key = (str(schema_name).strip().lower(), str(table_name).strip().lower())
    cached = _COLUMN_CACHE.get(cache_key)
    if cached is not None:
        return set(cached)
    rows = db.execute(
        text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema_name
              AND table_name = :table_name
        """),
        {"schema_name": schema_name, "table_name": table_name},
    ).mappings().all()
    columns = {str(row["column_name"]).lower() for row in rows}
    _COLUMN_CACHE[cache_key] = set(columns)
    return columns


def invalidate_column_cache(schema_name: str | None = None) -> None:
    """Invalida apenas metadados de estrutura; nenhum dado operacional é armazenado."""
    if schema_name is None:
        _COLUMN_CACHE.clear()
        return
    prefix = str(schema_name).strip().lower()
    for key in list(_COLUMN_CACHE):
        if key[0] == prefix:
            _COLUMN_CACHE.pop(key, None)


def filter_allowed_dictionary_tables(
    db: Any,
    tenant_schema: str,
    module_codes: Sequence[str],
    company_id: int | None = None,
) -> list[dict[str, Any]]:
    if not module_codes:
        return []

    schema_name = str(tenant_schema or "").strip()
    schema = quote_tenant_schema(schema_name)
    columns = _available_columns(db, schema_name, "dictionary_tables")
    if not {"table_code", "table_name", "module_code"}.issubset(columns):
        raise RuntimeError("Snapshot dictionary_tables não possui as colunas mínimas esperadas.")

    params: dict[str, Any] = {
        "tenant_id": schema_name,
        "module_codes": [str(code) for code in module_codes],
    }
    optional_columns = {
        "physical_name": "dt.physical_name",
        "unique_index": "dt.unique_index",
        "usa_empresa": "dt.usa_empresa",
        "usa_unidade": "dt.usa_unidade",
        "usa_filial": "dt.usa_filial",
        "x2_modo": "dt.x2_modo",
        "x2_tamfil": "dt.x2_tamfil",
        "x2_modoun": "dt.x2_modoun",
        "x2_tamun": "dt.x2_tamun",
        "x2_modoemp": "dt.x2_modoemp",
        "x2_tamemp": "dt.x2_tamemp",
    }
    selected_optional = [
        expression
        for column, expression in optional_columns.items()
        if column in columns
    ]
    select_optional = (",\n                " + ",\n                ".join(selected_optional)) if selected_optional else ""

    company_filter = ""
    if company_id is not None and "company_id" in columns:
        # Compatibilidade com snapshots legados que ainda possuem company_id
        # textual. A comparação textual evita UndefinedFunction (text = integer)
        # sem alterar ou copiar dados operacionais do Protheus.
        company_filter = """
            AND (dt.company_id::text = CAST(:company_id AS text) OR dt.company_id IS NULL)
        """
        params["company_id"] = str(company_id)

    active_filter = ""
    if "active_flag" in columns:
        active_filter = "AND COALESCE(dt.active_flag, TRUE) = TRUE"

    rows = db.execute(
        text(f"""
            SELECT DISTINCT
                dt.table_code,
                dt.table_name,
                dt.module_code,
                COALESCE(dt.description, dt.table_name) AS description{select_optional}
            FROM {schema}.dictionary_tables dt
            WHERE dt.tenant_id = :tenant_id
              AND dt.module_code::text = ANY(CAST(:module_codes AS text[]))
              {active_filter}
              {company_filter}
            ORDER BY dt.table_code
        """),
        params,
    ).mappings().all()

    return [dict(row) for row in rows]


def load_dictionary_fields(
    db: Any,
    tenant_schema: str,
    table_code: str | None,
    table_name: str | None,
) -> list[dict[str, Any]]:
    """Lê campos do snapshot sem assumir colunas opcionais de versões antigas."""
    schema_name = str(tenant_schema or "").strip()
    schema = quote_tenant_schema(schema_name)
    columns = _available_columns(db, schema_name, "dictionary_fields")
    if "field_name" not in columns:
        return []

    select_parts = ["df.field_name"]
    select_parts.append("COALESCE(df.title, df.field_name) AS field_label" if "title" in columns else "df.field_name AS field_label")
    optional_selects = {
        "field_type": "df.field_type",
        "length_num": "df.length_num AS field_length",
        "decimal_num": "df.decimal_num AS field_decimal",
        "validation_rule": "df.validation_rule",
        "sxg_group": "df.sxg_group",
        "sxg_size": "df.sxg_size",
    }
    for column, expression in optional_selects.items():
        if column in columns:
            select_parts.append(expression)

    params: dict[str, Any] = {
        "table_code": str(table_code or "").strip(),
        "table_name": str(table_name or "").strip(),
    }
    tenant_scope = ""
    if "tenant_id" in columns:
        tenant_scope = "df.tenant_id = :tenant_id AND "
        params["tenant_id"] = schema_name
    if "table_code" in columns:
        field_scope = f"{tenant_scope}df.table_code = :table_code"
    elif "table_name" in columns:
        field_scope = f"{tenant_scope}df.table_name = :table_name"
    else:
        return []

    order_by = "df.id" if "id" in columns else "df.field_name"
    rows = db.execute(
        text(f"""
            SELECT {', '.join(select_parts)}
            FROM {schema}.dictionary_fields df
            WHERE ({field_scope})
            ORDER BY {order_by}
        """),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def load_dictionary_indexes(
    db: Any,
    tenant_schema: str,
    table_code: str | None,
    table_name: str | None,
) -> list[dict[str, Any]]:
    """Lê índices SIX persistidos, tolerando snapshots sem atributos opcionais."""
    schema_name = str(tenant_schema or "").strip()
    schema = quote_tenant_schema(schema_name)
    columns = _available_columns(db, schema_name, "dictionary_indexes")
    if "table_code" not in columns and "table_name" not in columns:
        return []

    select_parts = []
    for column, expression in (
        ("index_order", "di.index_order"),
        ("nickname", "di.nickname"),
        ("expression", "di.expression"),
    ):
        if column in columns:
            select_parts.append(expression)
    if not select_parts:
        return []

    if "table_code" in columns:
        index_scope = "di.table_code = :table_code"
    else:
        index_scope = "di.table_name = :table_name"

    rows = db.execute(
        text(f"""
            SELECT {', '.join(select_parts)}
            FROM {schema}.dictionary_indexes di
            WHERE {index_scope}
            ORDER BY {"di.index_order" if "index_order" in columns else "di.table_name"}
        """),
        {"table_name": str(table_name or ""), "table_code": str(table_code or "")},
    ).mappings().all()
    return [dict(row) for row in rows]
