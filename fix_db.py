import re

with open('backend/app/db/database.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the public_queries list with an empty list
content = re.sub(r'public_queries\s*=\s*\[.*?\]', 'public_queries = []', content, flags=re.DOTALL)

# Replace the tenant_queries list with an empty list
content = re.sub(r'tenant_queries\s*=\s*\[.*?\]', 'tenant_queries = []', content, flags=re.DOTALL)

with open('backend/app/db/database.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Removed hardcoded DDL queries from database.py")
