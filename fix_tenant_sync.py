import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("def _sync_tenant_license_contract(db: Session, tenant: Tenant, tenant_schema: str) -> None:", "def _sync_tenant_license_contract(db: Session, tenant, tenant_schema: str, licenca_uso: str = None) -> None:")
content = content.replace("if not tenant.licenca_uso:", "if not licenca_uso:")
content = content.replace("tenant.licenca_uso", "licenca_uso")

content = content.replace("_sync_tenant_license_contract(db, tenant, clean_tenant)", "_sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)")

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed _sync_tenant_license_contract")
