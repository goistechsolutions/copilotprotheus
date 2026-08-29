from sqlalchemy import text, bindparam
from typing import List, Dict, Any

def get_allowed_catalog(session, tenant_id: str, environment_id: str, role_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Retorna o catálogo do Protheus (tabelas e campos do dicionário) permitido para
    os papéis (roles) do usuário autenticado no tenant/ambiente especificado.
    Utiliza expanding bind parameters do SQLAlchemy para máxima estabilidade no PostgreSQL.
    """
    if not role_ids:
        return []
        
    role_ids_str = [str(r) for r in role_ids]
    sql = text("""
        SELECT dt.table_name,
               dt.description,
               df.field_name,
               df.title,
               COALESCE(tfp.can_select, TRUE) AS can_select,
               COALESCE(tfp.can_filter, TRUE) AS can_filter,
               COALESCE(tfp.masked_flag, FALSE) AS masked_flag,
               TRUE AS can_query,
               TRUE AS can_list,
               TRUE AS can_describe
          FROM dictionary_tables dt
          LEFT JOIN dictionary_fields df
            ON df.tenant_id = dt.tenant_id
           AND df.environment_id = dt.environment_id
           AND df.table_code = dt.table_code
          LEFT JOIN tenant_field_permissions tfp
            ON tfp.tenant_id = df.tenant_id
           AND tfp.environment_id = df.environment_id
           AND tfp.table_name = df.table_name
           AND tfp.field_name = df.field_name
           AND tfp.role_id IN :role_ids
         WHERE dt.tenant_id = :tenant_id
           AND dt.environment_id = :environment_id
           AND COALESCE(dt.active_flag, TRUE) = TRUE
         ORDER BY dt.table_name, df.field_name
    """).bindparams(bindparam("role_ids", expanding=True))
    
    rows = session.execute(sql, {
        "tenant_id": str(tenant_id),
        "environment_id": str(environment_id),
        "role_ids": role_ids_str,
    }).mappings().all()
    
    return [dict(r) for r in rows]

def get_structured_catalog_by_role(session, tenant_id: str, environment_id: str, role_ids: List[str]) -> Dict[str, Any]:
    """
    Estrutura os dados do catálogo permitido em formato hierárquico (por tabela -> campos),
    ideal para injeção no prompt ou validação de escopo antes da geração de SQL do Copilot.
    """
    raw_rows = get_allowed_catalog(session, tenant_id, environment_id, role_ids)
    catalog = {}
    for row in raw_rows:
        tbl = row["table_name"]
        if tbl not in catalog:
            catalog[tbl] = {
                "table_name": tbl,
                "description": row["description"] or tbl,
                "permissions": {
                    "can_query": row["can_query"],
                    "can_list": row["can_list"],
                    "can_describe": row["can_describe"]
                },
                "allowed_fields": []
            }
        if row.get("field_name"):
            catalog[tbl]["allowed_fields"].append({
                "field_name": row["field_name"],
                "title": row.get("title") or row["field_name"],
                "can_select": bool(row.get("can_select", True)),
                "can_filter": bool(row.get("can_filter", True)),
                "masked": bool(row.get("masked_flag", False))
            })
    return catalog
