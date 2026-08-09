import re

def fix_file(fpath):
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove TenantDictionaryTable from knowledge
    content = re.sub(r'TenantDictionaryTable,\s*', '', content)
    content = re.sub(r',\s*TenantDictionaryTable', '', content)
    
    # Add DictionaryTable from catalog_v52
    if 'from app.models.catalog_v52 import' in content:
        if 'DictionaryTable' not in content:
            content = content.replace('from app.models.catalog_v52 import ', 'from app.models.catalog_v52 import DictionaryTable, ')
    else:
        # insert it
        content = re.sub(r'(from app.models.knowledge import.*?\n\))', r'\1\nfrom app.models.catalog_v52 import DictionaryTable\n', content, flags=re.DOTALL)
        if 'DictionaryTable' not in content: # if the above regex failed
            content = "from app.models.catalog_v52 import DictionaryTable\n" + content

    # Replace usages
    content = content.replace("TenantDictionaryTable", "DictionaryTable")

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

fix_file("backend/app/services/protheus_service.py")
fix_file("backend/app/services/ollama_client.py")
fix_file("backend/app/api/governance_routes.py")
fix_file("backend/app/api/admin_routes.py")

