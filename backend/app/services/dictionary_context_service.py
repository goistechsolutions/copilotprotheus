from sqlalchemy import text
from typing import Optional, List, Dict, Any, Union




def build_dictionary_context(
    db, 
    tenant_id: str, 
    company_id: Union[int, str, None], 

    module_filter: Optional[List[str]] = None, 
    keyword: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Constrói a árvore de contexto relacional do dicionário Protheus (tabelas + campos do SX2/SX3 v5.2),
    filtrando os módulos permitidos/solicitados no escopo do tenant.
    """
    import re
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if clean_tenant and clean_tenant != "public":
        try:
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        except Exception:
            pass
    params = {
        "tenant_id": tenant_id,
    }

    sql_tables = """
        SELECT
            table_name,
            COALESCE(description, table_alias, table_name) AS table_label,
            module_code,
            physical_name,
            active_flag
        FROM dictionary_tables
        WHERE tenant_id = :tenant_id
          AND active_flag = TRUE
    """

    if module_filter and isinstance(module_filter, list) and len(module_filter) > 0:
        sql_tables += " AND module_code = ANY(:module_filter)"
        params["module_filter"] = module_filter

    if keyword and str(keyword).strip():
        sql_tables += " AND (table_name ILIKE :kw OR description ILIKE :kw OR table_alias ILIKE :kw)"
        params["kw"] = f"%{keyword.strip()}%"

    sql_tables += " ORDER BY module_code, table_name"

    tables = db.execute(text(sql_tables), params).mappings().all()

    context = []
    for table in tables:
        fields = db.execute(
            text("""
                SELECT
                    field_name,
                    COALESCE(title, field_name) AS field_label,
                    field_type,
                    length_num AS field_length,
                    decimal_num AS field_decimal,
                    required_flag
                FROM dictionary_fields
                WHERE tenant_id = :tenant_id
                  AND table_name = :table_name
                ORDER BY id
            """),
            {
                "tenant_id": tenant_id,
                "table_name": table["table_name"],
            }
        ).mappings().all()

        context.append({
            "table": dict(table),
            "fields": [dict(f) for f in fields]
        })

    return context


def render_context_for_prompt(context: List[Dict[str, Any]]) -> str:
    """
    Formata a estrutura relacional das tabelas e campos selecionados em texto estruturado
    e otimizado para injeção de contexto em LLMs / Agentes SQL.
    """
    parts = []

    for item in context:
        t = item["table"]
        t_name = t.get("table_name", "")
        t_phys = t.get("physical_name") or f"{t_name}010"
        parts.append(
            f"TABLE {t_name} (Physical: {t_phys} | Desc: {t.get('table_label') or ''}) "
            f"[Módulo Protheus: {t.get('module_code') or 'Geral'}]"
        )

        for f in item.get("fields", []):
            parts.append(
                f"  FIELD: {f['field_name']} - {f.get('field_label') or ''} "
                f"| type={f.get('field_type') or 'C'} len={f.get('field_length') or '10'} dec={f.get('field_decimal') or '0'}"
            )

    return "\n".join(parts)
