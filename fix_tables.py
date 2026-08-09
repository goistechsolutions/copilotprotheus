import re

files = [
    "backend/app/api/admin_routes.py",
    "backend/app/api/governance_routes.py",
    "backend/app/services/protheus_service.py",
    "backend/app/services/ollama_client.py"
]

for fpath in files:
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Import fix: remove TenantDictionaryTable from knowledge
    content = re.sub(r'TenantDictionaryTable,\s*', '', content)
    content = re.sub(r'TenantDictionaryTable', '', content) # if it's the last one in the import
    # Add new import
    if "from app.models.catalog_v52 import" in content:
        content = content.replace("from app.models.catalog_v52 import", "from app.models.catalog_v52 import DictionaryTable, ")
    else:
        # Add it right after knowledge import
        content = re.sub(r'(from app.models.knowledge import.*?\n)', r'\1from app.models.catalog_v52 import DictionaryTable\n', content, count=1, flags=re.DOTALL)

    # Replace usages
    # Wait, the second sub above replaced ALL 'TenantDictionaryTable' with '' !!!
    pass

