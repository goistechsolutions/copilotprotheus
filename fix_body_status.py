import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('status=body.status or \'ACTIVE\'', 'status=(body.status or \'ACTIVE\').upper()')

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed body.status upper")
