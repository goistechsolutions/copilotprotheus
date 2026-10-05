import re

path = 'backend/app/api/admin_billing_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'    billing_cycle: str = Field.*?\n', '', content)
content = re.sub(r'    overage_mode: str = Field.*?\n', '', content)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
