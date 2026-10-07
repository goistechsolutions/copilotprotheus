import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = 'sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id)"'
replacement = 'sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id OR id::text = :tenant_id)"'

if target in content:
    content = content.replace(target, replacement)
    with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("Corrigido list_companies!")
else:
    print("Alvo não encontrado.")
