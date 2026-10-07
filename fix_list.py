import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_list = """
def list_companies(db, tenant_id=None):
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
        from app.db.database import resolve_clean_tenant
        try:
            clean = resolve_clean_tenant(db, t_code)
        except Exception:
            clean = t_code

        try:
            # Pega o primeiro ambiente e conexao
            env_row = db.execute(text(f'SELECT id, environment_code, environment_name FROM "{clean}".environments LIMIT 1')).mappings().first()
            conn_row = None
            if env_row:
                conn_row = db.execute(text(f'SELECT base_rest_url, auth_mode, secret_ref FROM "{clean}".protheus_connections WHERE environment_id = :eid LIMIT 1'), {"eid": env_row["id"]}).mappings().first()
            
            env_code = env_row["environment_code"] if env_row else ""
            rest_url = conn_row["base_rest_url"] if conn_row else ""
            
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
                    "protheus_ambientes": env_code,
                    "protheus_rest_url": rest_url,
                    "status": c["status"]
                })
        except Exception as e:
            print("Erro ao listar empresas do tenant", clean, e)

    return result
"""

# Replace the existing list_companies
content = re.sub(r'def list_companies\(db, tenant_id=None\):.*?return result', new_list, content, flags=re.DOTALL)

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
