"""Serviço de leitura do catálogo estrutural por módulos.

O catálogo canônico é composto por ``dictionary_tables`` e
``dictionary_fields`` no schema do tenant. ``tenant_schemas`` não é mais
utilizada por este fluxo.
"""

import re
from typing import List

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Result

from app.services.module_sync_resolver import resolve_modules_to_numeric_codes


def _safe_schema_name(value: str) -> str:
    schema = str(value or "").strip().lower()
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema):
        raise HTTPException(status_code=400, detail="Schema de tenant inválido.")
    return schema


def sync_selected_modules(db, tenant_schema: str, selected_modules: List[str]):
    """Lê tabelas e campos do catálogo canônico para os módulos selecionados."""
    schema = _safe_schema_name(tenant_schema)
    module_codes = resolve_modules_to_numeric_codes(db, schema, selected_modules)

    if not module_codes:
        raise HTTPException(status_code=400, detail="Nenhum módulo resolvido para sincronização.")

    sql = text(f"""
        SELECT
            dt.module_code,
            dt.table_code AS chave,
            COALESCE(NULLIF(BTRIM(dt.physical_name), ''), dt.table_name) AS tabela,
            dt.table_name AS nome,
            df.field_name AS campo,
            df.title AS campo_titulo,
            df.field_type AS campo_tipo,
            df.length_num AS campo_tamanho,
            df.decimal_num AS campo_decimal
        FROM {schema}.dictionary_tables dt
        LEFT JOIN {schema}.dictionary_fields df
          ON df.tenant_id = dt.tenant_id
         AND (df.company_id = dt.company_id OR df.company_id IS NULL)
         AND df.table_code = dt.table_code
        WHERE dt.active_flag = TRUE
          AND dt.module_code::text = ANY(CAST(:modules AS text[]))
        ORDER BY dt.table_code, df.field_name
    """)

    try:
        result: Result = db.execute(sql, {"modules": module_codes})
        rows = result.fetchall()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar o catálogo estrutural do tenant.",
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Nenhuma tabela encontrada para os módulos selecionados: "
                f"{', '.join(selected_modules)}. Códigos resolvidos: {', '.join(module_codes)}."
            ),
        )

    return rows
