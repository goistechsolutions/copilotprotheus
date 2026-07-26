from sqlalchemy import text

def get_allowed_catalog(session, tenant_id, environment_id, role_ids):
    sql = text("""
        SELECT dt.table_name,
               dt.description,
               df.field_name,
               df.title,
               tfp.can_select,
               tfp.can_filter,
               ttp.can_query
          FROM dictionary_tables dt
          JOIN tenant_table_permissions ttp
            ON ttp.tenant_id = dt.tenant_id
           AND ttp.environment_id = dt.environment_id
           AND ttp.table_name = dt.table_name
          LEFT JOIN dictionary_fields df
            ON df.tenant_id = dt.tenant_id
           AND df.environment_id = dt.environment_id
           AND df.snapshot_code = dt.snapshot_code
           AND df.table_name = dt.table_name
          LEFT JOIN tenant_field_permissions tfp
            ON tfp.tenant_id = df.tenant_id
           AND tfp.environment_id = df.environment_id
           AND tfp.table_name = df.table_name
           AND tfp.field_name = df.field_name
           AND tfp.role_id = ANY(:role_ids)
         WHERE dt.tenant_id = :tenant_id
           AND dt.environment_id = :environment_id
           AND ttp.role_id = ANY(:role_ids)
           AND ttp.can_describe = TRUE
         ORDER BY dt.table_name, df.field_name
    """)
    return session.execute(sql, {
        "tenant_id": str(tenant_id),
        "environment_id": str(environment_id),
        "role_ids": [str(r) for r in role_ids],
    }).mappings().all()
