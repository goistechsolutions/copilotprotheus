from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from sqlalchemy import text

from app.services.protheus_module_catalog import quote_tenant_schema


def build_dictionary_context(
    db,
    tenant_id: str,
    company_id: Union[int, str, None],
    module_filter: Optional[List[str]] = None,
    keyword: Optional[str] = None,
    environment_id: Optional[str] = None,
    role_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Carrega o contexto autorizado do dicionário Protheus.

    A estrutura usa os metadados persistidos do snapshot SX2/SX3/SXG/SIX. Não
    cria nome físico, índice, filial ou relacionamento quando o snapshot não
    possui esse valor.
    """
    clean_tenant = str(tenant_id or "").strip().lower()
    schema = quote_tenant_schema(clean_tenant)
    params: Dict[str, Any] = {"tenant_id": clean_tenant}

    sql_tables = f"""
        SELECT DISTINCT
            dt.table_name,
            COALESCE(dt.description, dt.table_name) AS table_label,
            dt.module_code,
            dt.table_code,
            dt.table_alias,
            dt.physical_name,
            dt.unique_index,
            dt.usa_empresa,
            dt.usa_unidade,
            dt.usa_filial,
            dt.x2_modo,
            dt.x2_tamfil,
            dt.x2_modoun,
            dt.x2_tamun,
            dt.x2_modoemp,
            dt.x2_tamemp
        FROM {schema}.dictionary_tables dt
        JOIN {schema}.tenant_schemas ts
          ON ts.chave = dt.table_code
         AND ts.tabela = dt.table_name
         AND ts.mod_code::text = dt.module_code::text
        WHERE 1 = 1
    """

    if company_id is not None:
        sql_tables += " AND (dt.company_id = :company_id OR dt.company_id IS NULL)"
        params["company_id"] = str(company_id)

    if environment_id is not None:
        sql_tables += " AND (dt.environment_id = :environment_id OR dt.environment_id IS NULL)"
        params["environment_id"] = str(environment_id)

    if module_filter:
        normalized_modules = [str(module).strip() for module in module_filter if str(module).strip()]
        if normalized_modules:
            sql_tables += " AND dt.module_code::text = ANY(:module_filter)"
            params["module_filter"] = normalized_modules

    if keyword and str(keyword).strip():
        sql_tables += " AND (dt.table_name ILIKE :kw OR dt.description ILIKE :kw OR dt.table_code ILIKE :kw)"
        params["kw"] = f"%{str(keyword).strip()}%"

    sql_tables += " ORDER BY dt.module_code, dt.table_name"
    tables = db.execute(text(sql_tables), params).mappings().all()

    context: List[Dict[str, Any]] = []
    for table in tables:
        table_data = dict(table)
        table_name = str(table_data.get("table_name") or "").strip()
        table_code = str(table_data.get("table_code") or "").strip()
        field_params: Dict[str, Any] = {"table_name": table_name, "table_code": table_code}
        field_scope = "(df.table_name = :table_name OR df.table_code = :table_code)"
        if environment_id is not None:
            field_scope += " AND (df.environment_id = :environment_id OR df.environment_id IS NULL)"
            field_params["environment_id"] = str(environment_id)

        fields = db.execute(
            text(f"""
                SELECT
                    df.field_name,
                    COALESCE(df.title, df.field_name) AS field_label,
                    df.field_type,
                    df.length_num AS field_length,
                    df.decimal_num AS field_decimal,
                    df.validation_rule,
                    df.relation_rule,
                    df.when_rule,
                    df.sxg_group,
                    df.sxg_size
                FROM {schema}.dictionary_fields df
                WHERE {field_scope}
                ORDER BY df.id
            """),
            field_params,
        ).mappings().all()

        indexes = db.execute(
            text(f"""
                SELECT index_order, nickname, expression
                FROM {schema}.dictionary_indexes
                WHERE table_name IN (:table_name, :table_code)
                ORDER BY index_order
            """),
            {"table_name": table_name, "table_code": table_code},
        ).mappings().all()

        context.append({
            "table": table_data,
            "fields": [dict(field) for field in fields],
            "indexes": [dict(index) for index in indexes],
            "role_ids": [str(role) for role in (role_ids or []) if str(role).strip()],
        })

    return context


def render_context_for_prompt(context: List[Dict[str, Any]]) -> str:
    """Renderiza SX2/SX3/SIX e regras de compartilhamento para o gerador SQL."""
    parts: List[str] = []

    for item in context:
        table = item.get("table") or {}
        table_code = table.get("table_code") or ""
        table_name = table.get("table_name") or ""
        physical_name = table.get("physical_name") or table.get("table_alias") or "não informado no snapshot"
        parts.append(
            f"TABLE {table_code} - {table_name} "
            f"(Physical: {physical_name} | Desc: {table.get('table_label') or 'não informado'} | "
            f"Módulo: {table.get('module_code') or 'não informado'})"
        )
        parts.append(
            "  SHARING: "
            f"empresa={table.get('usa_empresa') or 'não informado'} "
            f"unidade={table.get('usa_unidade') or 'não informado'} "
            f"filial={table.get('usa_filial') or 'não informado'} "
            f"X2_MODO={table.get('x2_modo') or 'não informado'} "
            f"X2_TAMFIL={table.get('x2_tamfil') if table.get('x2_tamfil') is not None else 'não informado'} "
            f"X2_MODOUN={table.get('x2_modoun') or 'não informado'} "
            f"X2_TAMUN={table.get('x2_tamun') if table.get('x2_tamun') is not None else 'não informado'} "
            f"X2_MODOEMP={table.get('x2_modoemp') or 'não informado'} "
            f"X2_TAMEMP={table.get('x2_tamemp') if table.get('x2_tamemp') is not None else 'não informado'}"
        )
        parts.append(f"  UNIQUE_INDEX: {table.get('unique_index') or 'não informado no snapshot'}")

        for index in item.get("indexes", []):
            parts.append(
                f"  SIX_INDEX: order={index.get('index_order') or 'não informado'} "
                f"name={index.get('nickname') or 'não informado'} "
                f"expression={index.get('expression') or 'não informado'}"
            )

        for field in item.get("fields", []):
            parts.append(
                f"  FIELD: {field.get('field_name') or 'não informado'} - "
                f"{field.get('field_label') or 'não informado'} "
                f"| type={field.get('field_type') or 'não informado'} "
                f"len={field.get('field_length') if field.get('field_length') is not None else 'não informado'} "
                f"dec={field.get('field_decimal') if field.get('field_decimal') is not None else 'não informado'} "
                f"validation={field.get('validation_rule') or 'não informado'} "
                f"relation={field.get('relation_rule') or 'não informado'}"
            )

    return "\n".join(parts)
