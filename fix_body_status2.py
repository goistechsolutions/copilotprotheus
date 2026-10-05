import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('tenant.status = body.status or tenant.status', 'tenant.status = str(body.status or tenant.status).upper()')
content = content.replace('tenant.status = body.status\n', 'tenant.status = str(body.status).upper()\n')

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed update body.status upper")
