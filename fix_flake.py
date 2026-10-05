import re

with open('backend/app/api/business_governance_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'from app\.core\.admin_security import require_admin',
    'from app.core.admin_security import require_admin, authorize_admin_access',
    content
)

with open('backend/app/api/business_governance_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
