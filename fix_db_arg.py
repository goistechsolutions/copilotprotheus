import re

def fix_resolve_clean_tenant():
    # 1. Fix tenant_routes.py
    path = 'backend/app/api/tenant_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # In _sync_protheus_connection
    content = content.replace('clean_tenant = resolve_clean_tenant(tenant_code)', 'clean_tenant = resolve_clean_tenant(db, tenant_code)')
    # In _to_tenant_dict
    content = content.replace('clean_tenant = resolve_clean_tenant(t.tenant_code)', 'clean_tenant = resolve_clean_tenant(db, t.tenant_code)')
    
    # In update_tenant, it uses the global one but we can replace it with the db one or use tenant.schema_name!
    content = content.replace('clean_tenant = resolve_clean_tenant(tenant.tenant_code)', 'clean_tenant = resolve_clean_tenant(db, tenant.tenant_code)')
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

    # 2. Fix protheus_token_service.py
    path = 'backend/app/services/protheus_token_service.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('clean_tenant = resolve_clean_tenant(tenant_code)', 'clean_tenant = resolve_clean_tenant(db, tenant_code)')

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_resolve_clean_tenant()
