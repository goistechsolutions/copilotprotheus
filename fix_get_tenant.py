import re

filepath = r'C:\projeto\copilotprotheus\backend\app\api\tenant_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_tenant
pattern = r'(def get_tenant.*?\n\s+tenant = find_tenant_by_id_or_code.*?)\n\s+if body\.protheus_rest_url:\n\s+await _sync_protheus_connection\(.*?\)\n\n\s+return _to_tenant_dict\(db, tenant\)'
content = re.sub(pattern, r'\1\n    return _to_tenant_dict(db, tenant)', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
