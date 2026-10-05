import re

def fix_tenant_rollback():
    path = 'backend/app/api/tenant_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # In create_tenant: replace db.commit() with db.flush() until the end.
    old_create = '''
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    else:
        tenant.tenant_name = body.name or tenant.tenant_name
        tenant.status = str(body.status or tenant.status).upper()
        db.commit()
        db.refresh(tenant)

    # Garante o schema isolado
    db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})
    db.commit()

    # Materializa a licena assinada no contrato exigido pelo EntitlementGuard.
    if getattr(body, "licenca_uso", None) is not None:
        _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

    # Processa e valida conexo REST Protheus
    conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
    if conn_info:
        await _sync_protheus_connection(db, clean_tenant, conn_info)

    return _to_tenant_dict(db, tenant)
'''

    new_create = '''
        db.add(tenant)
        db.flush()
    else:
        tenant.tenant_name = body.name or tenant.tenant_name
        tenant.status = str(body.status or tenant.status).upper()
        db.flush()

    try:
        # Garante o schema isolado
        db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})

        # Materializa a licena assinada no contrato exigido pelo EntitlementGuard.
        if getattr(body, "licenca_uso", None) is not None:
            _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

        # Processa e valida conexo REST Protheus
        conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
        if conn_info:
            await _sync_protheus_connection(db, clean_tenant, conn_info)
            
        db.commit()
        db.refresh(tenant)
    except Exception as e:
        db.rollback()
        raise e

    return _to_tenant_dict(db, tenant)
'''
    # We replace the body of create_tenant
    content = content.replace(old_create.strip(), new_create.strip())
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_tenant_rollback()
