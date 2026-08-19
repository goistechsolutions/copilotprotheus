import re

with open('backend/app/services/dictionary_context_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove get_latest_snapshot_code function
content = re.sub(r'def get_latest_snapshot_code.*?return row\["snapshot_code"\] if row else None\n', '', content, flags=re.DOTALL)

# Remove snapshot_code param from build_dictionary_context
content = re.sub(r'\s*snapshot_code:\s*str,\n', '\n', content)

# Remove snapshot_code binding in the query
content = re.sub(r'\s*"snapshot_code":\s*snapshot_code,', '', content)

# Remove snapshot_code conditions in SQL strings
content = re.sub(r'\s+AND snapshot_code\s*=\s*:snapshot_code', '', content)
content = re.sub(r'\s+AND df\.snapshot_code\s*=\s*dt\.snapshot_code', '', content)

with open('backend/app/services/dictionary_context_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("dictionary_context_service patched")
