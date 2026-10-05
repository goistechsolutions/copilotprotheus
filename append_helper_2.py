def get_enabled_modules(db, company_id, tenant_id: str) -> list[str]:
    enabled = get_enabled_company_modules(db, tenant_id)
    if not enabled:
        raise HTTPException(
            status_code=400, 
            detail="Nenhum módulo habilitado ou contratado encontrado para este tenant."
        )
    return enabled
