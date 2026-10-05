import re

with open('backend/tests/test_company_crud_contract.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix _ModuleWriteDB
content = content.replace(
    '{"mod_code": 2, "mod_sigla": "SIGACOM", "mod_name": "Compras"}',
    '{"id": 2, "module_sigla": "SIGACOM", "description": "Compras"}'
)

# Fix expected SQL in test_replace_company_modules_refreshes_active_contract_scope
content = content.replace(
    'assert \'INSERT INTO "tenant_fixture".protheus_modules\' in sql',
    'assert \'INSERT INTO "tenant_fixture".tenant_modules\' in sql'
)

with open('backend/tests/test_company_crud_contract.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed _ModuleWriteDB")
