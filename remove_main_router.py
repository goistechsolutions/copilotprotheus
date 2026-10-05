import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'from app\.api\.business_rules_routes import router as business_rules_router\n?', '', content)
content = re.sub(r'app\.include_router\(business_rules_router, prefix="/api"\)\n?', '', content)

with open('backend/app/main.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
