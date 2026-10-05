def list_companies(db, tenant_id=None):
    from sqlalchemy import text
    sql = "SELECT id, tenant_code, tenant_name, status, created_at, updated_at FROM public.tenants WHERE 1=1"
    params = {}
    if tenant_id:
        sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id)"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY tenant_name"
    rows = db.execute(text(sql), params).mappings().all()

    result = []
    for r in rows:
        t_code = r["tenant_code"]
        
        result.append({
            "id": r["id"],
            "tenant_id": t_code,
            "tenant_name": r["tenant_name"],
            "status": r["status"]
        })
    return result

def list_company_modules(db, company_id, tenant_id: str) -> list[dict]:
    return get_tenant_module_setup(db, tenant_id)

def preload_allowed_tables_from_dictionary(db, company_id, tenant_id: str):
    clean_tenant = resolve_clean_tenant(tenant_id)
    try:
        db.execute(text(f'UPDATE "{clean_tenant}".dictionary_tables SET status = \'ACTIVE\''))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Aviso ao atualizar tabelas permitidas em {clean_tenant}: {e}")
