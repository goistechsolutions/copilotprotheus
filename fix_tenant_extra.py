import re

with open('backend/app/schemas/tenant.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('extra="forbid"', 'extra="ignore"')

with open('backend/app/schemas/tenant.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
