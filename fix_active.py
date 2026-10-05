import re

# Fix knowledge.py
with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('default="active"', 'default="ACTIVE"')

with open('backend/app/models/knowledge.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Fix tenant_routes.py
with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('t.status or "active"', 't.status or "ACTIVE"')
content = content.replace('body.status or "active"', 'body.status or "ACTIVE"')
content = content.replace('WHERE tenant_code = :tc AND active = TRUE', 'WHERE tenant_code = :tc AND status = \'ACTIVE\'')

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Fix schemas/tenant.py
with open('backend/app/schemas/tenant.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('status: str = "active"', 'status: str = "ACTIVE"')

with open('backend/app/schemas/tenant.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed active to ACTIVE")
