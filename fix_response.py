import re

path = 'backend/app/api/admin_billing_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"billing_cycle": plan.billing_cycle, ', '')
content = content.replace('"overage_mode": plan.overage_mode, ', '')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
