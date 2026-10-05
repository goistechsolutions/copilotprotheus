import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("plan_code=tenant.plan_code,", "plan_code=None,")
content = content.replace("cnpj=tenant.cnpj,", "cnpj=None,")

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed plan_code and cnpj in sync")
