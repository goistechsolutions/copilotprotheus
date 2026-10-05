import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Tenant(...) instantiations to only use valid fields
content = re.sub(
    r'tenant = Tenant\((.*?)\)',
    "tenant = Tenant(\n"
    "            tenant_code=clean_tenant,\n"
    "            tenant_name=body.name or clean_tenant,\n"
    "            schema_name=clean_tenant,\n"
    "            status=body.status or 'ACTIVE'\n"
    "        )",
    content,
    flags=re.DOTALL
)

# Remove the tenant field assignments in the else block
content = re.sub(r'tenant\.plan_code = .*?\n', '', content)
content = re.sub(r'tenant\.cnpj = .*?\n', '', content)
content = re.sub(r'tenant\.licenca_uso = .*?\n', '', content)
content = re.sub(r'tenant\.webapp_url = .*?\n', '', content)
content = re.sub(r'tenant\.system_prompt = .*?\n', '', content)
content = re.sub(r'tenant\.temperature = .*?\n', '', content)

# _to_tenant_dict function
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

print("Fixed tenant_routes.py")
