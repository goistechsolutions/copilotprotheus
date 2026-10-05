import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "def replace_company_modules(db, company_id, tenant_id: str, enabled_siglas: list[str]) -> list[dict]:",
    "def replace_company_modules(db, company_id, tenant_id: str, payload: list[str]) -> list[dict]:"
)
content = content.replace("for sigla in enabled_siglas:", "for sigla in payload:")

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed payload in replace_company_modules")
