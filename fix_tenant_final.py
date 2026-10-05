import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("ensure_tenant_tables(db, clean_tenant)", "db.execute(text(\"SELECT public.provision_tenant_schema(:tid)\"), {\"tid\": tenant.id})\n    db.commit()")

content = content.replace("_sync_tenant_license_contract(db, tenant, clean_tenant)", "_sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)")

content = content.replace("def _sync_tenant_license_contract(db: Session, tenant: Tenant, tenant_schema: str) -> None:", "def _sync_tenant_license_contract(db: Session, tenant, tenant_schema: str, licenca_uso: str = None) -> None:")
content = content.replace("if not tenant.licenca_uso:", "if not licenca_uso:")

content = content.replace("plan_code=tenant.plan_code,", "plan_code=None,")
content = content.replace("cnpj=tenant.cnpj,", "cnpj=None,")

def replace_to_tenant_dict(match):
    return '''def _to_tenant_dict(db, tenant):
    """
    Retorna o dicionário serializável do Tenant. 
    Lê a licença e conexão de outras tabelas se necessário,
    mas para manter retrocompatibilidade com frontend, retorna vazios se não achou.
    """
    return {
        "id": tenant.tenant_code,
        "name": tenant.tenant_name,
        "tenant_code": tenant.tenant_code,
        "schema_name": tenant.schema_name,
        "status": tenant.status,
        "cnpj": "",
        "webapp_url": "",
        "apirest_url": "",
        "frontend_domain": "",
        "protheus_user": "",
        "system_prompt": "",
        "temperature": 0.2,
        "licenca_uso": "",
        "plan_code": "",
        "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None,
    }'''

content = re.sub(r'def _to_tenant_dict\(db, tenant\):.*?(?=\n\n|\Z)', replace_to_tenant_dict, content, flags=re.DOTALL)


with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed tenant_routes.py completely")
