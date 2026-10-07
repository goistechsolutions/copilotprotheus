import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("'active'", "'ACTIVE'")

with open('backend/app/api/company_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
