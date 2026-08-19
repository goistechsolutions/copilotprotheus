import re

# sync_dictionary_v52.py
with open('backend/app/services/sync_dictionary_v52.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("AND snapshot_code= ", "")
with open('backend/app/services/sync_dictionary_v52.py', 'w', encoding='utf-8') as f:
    f.write(content)

# database.py
with open('backend/app/db/database.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'\s*snapshot_code VARCHAR\(60\) NOT NULL,', '', content)
with open('backend/app/db/database.py', 'w', encoding='utf-8') as f:
    f.write(content)

# catalog_v52_routes.py
with open('backend/app/api/catalog_v52_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'\s*snapshot_code: Optional\[str\] = Field\(None, description="Cdigo opcional do snapshot \(timestamp por padro\)"\)', '', content)
content = re.sub(r',\s*req\.snapshot_code', '', content)
content = re.sub(r'DictionaryField\.snapshot_code == t\.snapshot_code', 'True', content)
content = re.sub(r'\s*"snapshot_code": t\.snapshot_code,', '', content)
with open('backend/app/api/catalog_v52_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

# agent_sql_routes.py
with open('backend/app/api/agent_sql_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'\s*if not snapshot_code:\n\s*raise HTTPException\([\s\S]*?\)\n', '\n', content)
content = re.sub(r'\s*"snapshot_code": snapshot_code,', '', content)
with open('backend/app/api/agent_sql_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

# dictionary_context_service.py
with open('backend/app/services/dictionary_context_service.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'snapshot_code:\s*str,\n', '', content)
with open('backend/app/services/dictionary_context_service.py', 'w', encoding='utf-8') as f:
    f.write(content)


print("Done")
