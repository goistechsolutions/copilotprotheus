import re

with open('backend/app/schemas/tenant.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove connection, protheus_webapp_url, system_prompt, temperature, licenca_uso
# Wait, are there other dependencies? Let's just remove them from TenantResponse and TenantCreate, TenantUpdate.
# I will only remove connection and webapp_url.
content = re.sub(r'    connection: Optional\[Dict\[str, Any\]\] = None\n', '', content)
content = re.sub(r'    protheus_webapp_url: Optional\[str\] = None\n', '', content)

with open('backend/app/schemas/tenant.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
