import re

with open('backend/app/api/tenant_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "ensure_tenant_tables(db, clean_tenant)", 
    "db.execute(text(\"SELECT public.provision_tenant_schema(:tid)\"), {\"tid\": tenant.id})\n    db.commit()"
)

with open('backend/app/api/tenant_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed provision_tenant_schema")
