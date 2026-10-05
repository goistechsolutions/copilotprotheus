import re

with open('backend/app/services/tenant_resolver.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("SELECT id, tenant_code, schema_name, frontend_domain, api_domain, status", "SELECT id, tenant_code, schema_name, status")
content = content.replace("\"effective_frontend_domain\": effective.get(\"frontend_domain\") if effective else None,", "\"effective_frontend_domain\": None,")
content = content.replace("\"effective_api_domain\": effective.get(\"api_domain\") if effective else None,", "\"effective_api_domain\": None,")

with open('backend/app/services/tenant_resolver.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed tenant_resolver.py")
