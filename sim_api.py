import psycopg2

try:
    dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    cur.execute("SELECT id, tenant_code, tenant_name, status FROM public.tenants WHERE tenant_code = 'rodol' OR schema_name = 'rodol'")
    rows = cur.fetchall()
    
    result = []
    for r in rows:
        t_code = r[1]
        clean = "rodol"
        
        cur.execute(f'SELECT id, environment_code, environment_name FROM "{clean}".environments LIMIT 1')
        env_row = cur.fetchone()
        
        conn_row = None
        if env_row:
            cur.execute(f'SELECT base_rest_url, auth_mode, secret_ref FROM "{clean}".protheus_connections WHERE environment_id = %s LIMIT 1', (env_row[0],))
            conn_row = cur.fetchone()
            
        env_code = env_row[1] if env_row else ""
        rest_url = conn_row[0] if conn_row else ""
        
        cur.execute(f'SELECT id, company_code, branch_code, legal_name, tax_id, status FROM "{clean}".companies')
        c_rows = cur.fetchall()
        
        for c in c_rows:
            result.append({
                "id": str(c[0]),
                "tenant_id": t_code,
                "tenant_name": r[2],
                "cnpj": c[4] or "",
                "razao_social": c[3],
                "protheus_empresa": c[1],
                "protheus_filial": c[2],
                "protheus_ambientes": env_code,
                "protheus_rest_url": rest_url,
                "status": c[5]
            })
    print("SUCCESS:")
    print(result)
except Exception as e:
    print("ERROR:")
    print(e)
