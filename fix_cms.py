import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_company_modules_catalog
content = re.sub(
    r'SELECT mod_code, mod_sigla, mod_name\n.*?FROM public\.protheus_modules_master\n.*?WHERE active = TRUE\n.*?ORDER BY mod_code',
    r'SELECT id AS module_id, module_sigla, description\n            FROM public.protheus_modules_master\n            WHERE active = TRUE\n            ORDER BY id',
    content,
    flags=re.DOTALL
)

# Replace access to mod_code, mod_sigla
content = content.replace('row.get("mod_sigla")', 'row.get("module_sigla")')
content = content.replace('row.get("mod_code")', 'row.get("module_id")')

# Replace replace_company_modules
content = re.sub(
    r'INSERT INTO "{clean_tenant}"\.protheus_modules\n.*?\(tenant_id, mod_code, mod_sigla, mod_name\)\n.*?VALUES \(:tid, :mcode, :msigla, :mname\)\n.*?ON CONFLICT \(tenant_id, mod_code\) DO UPDATE SET\n.*?mod_sigla = EXCLUDED\.mod_sigla,\n.*?mod_name  = EXCLUDED\.mod_name',
    r'INSERT INTO "{clean_tenant}".tenant_modules (module_id, enabled) VALUES (:mcode, true) ON CONFLICT (module_id) DO UPDATE SET enabled = EXCLUDED.enabled',
    content,
    flags=re.DOTALL
)

# And clear the old delete before
content = re.sub(r'DELETE FROM "{clean_tenant}"\.protheus_modules WHERE tenant_id = :tid', r'UPDATE "{clean_tenant}".tenant_modules SET enabled = false', content)

# Fix read queries in get_enabled_company_modules
content = re.sub(
    r'SELECT mod_sigla FROM "{clean_tenant}"\.protheus_modules ORDER BY mod_code',
    r'SELECT m.module_sigla FROM "{clean_tenant}".tenant_modules tm JOIN public.protheus_modules_master m ON m.id = tm.module_id WHERE tm.enabled = true ORDER BY tm.module_id',
    content
)
content = content.replace('r["mod_sigla"]', 'r["module_sigla"]')

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed company_module_service.py (Part 1)")
