import re

# catalog_v52.py
with open('backend/app/models/catalog_v52.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\n    snapshot_code = Column\(String\(60\), nullable=False(?:, index=True)?\)', '', content)
content = re.sub(r'\"snapshot_code\",\s*', '', content)

with open('backend/app/models/catalog_v52.py', 'w', encoding='utf-8') as f:
    f.write(content)


# sync_dictionary_v52.py
with open('backend/app/services/sync_dictionary_v52.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'snapshot_code: Optional\[str\] = None,?', '', content)
content = re.sub(r'snapshot_code = snapshot_code or .*?\n', '', content)
content = re.sub(r',\s*snapshot_code=snapshot_code', '', content)
content = re.sub(r',\s*snapshot_code', '', content)
content = re.sub(r'\"snapshot_code\": snapshot_code,?', '', content)
content = re.sub(r':snapshot_code,?', '', content)
content = re.sub(r'AND snapshot_code=:snapshot_code', '', content)
content = re.sub(r'AND df\.snapshot_code = dt\.snapshot_code', '', content) # from catalog_service_v52

with open('backend/app/services/sync_dictionary_v52.py', 'w', encoding='utf-8') as f:
    f.write(content)


# catalog_service_v52.py
with open('backend/app/services/catalog_service_v52.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'\s*AND df\.snapshot_code = dt\.snapshot_code', '', content)
with open('backend/app/services/catalog_service_v52.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Finished cleanup scripts")
