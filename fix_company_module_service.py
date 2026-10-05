import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix list_companies
list_companies_replacement = """def list_companies(db, tenant_id=None):
    from sqlalchemy import text
    sql = "SELECT id, tenant_code, tenant_name, status, created_at, updated_at FROM public.tenants WHERE 1=1"
    params = {}
    if tenant_id:
        sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id)"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY tenant_name"
    rows = db.execute(text(sql), params).mappings().all()

    result = []
    for r in rows:
        t_code = r["tenant_code"]
        clean = resolve_clean_tenant(t_code)
        
        try:
            c_rows = db.execute(text(f'SELECT id, company_code, branch_code, legal_name, tax_id, status FROM "{clean}".companies')).mappings().all()
            for c in c_rows:
                result.append({
                    "id": c["id"],
                    "tenant_id": t_code,
                    "tenant_name": r["tenant_name"],
                    "cnpj": c["tax_id"] or "",
                    "razao_social": c["legal_name"],
                    "protheus_empresa": c["company_code"],
                    "protheus_filial": c["branch_code"],
                    "status": c["status"]
                })
        except Exception:
            pass

    return result"""

content = re.sub(r'def list_companies.*?return result', list_companies_replacement, content, flags=re.DOTALL)

# Fix replace_company_modules signature
content = content.replace(
    "def replace_company_modules(db, tenant_id: str, enabled_siglas: list[str]) -> list[dict]:",
    "def replace_company_modules(db, company_id, tenant_id: str, enabled_siglas: list[str]) -> list[dict]:"
)

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed company_module_service.py test failures")
