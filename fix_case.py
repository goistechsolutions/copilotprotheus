import re

with open('backend/app/api/admin_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = 'scope_level: str = "tenant"'
replacement = 'scope_level: str = "TENANT"'
content = content.replace(target, replacement)

with open('backend/app/api/admin_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Fixado!")
