import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("""
    SELECT id, tenant_code, tenant_name, schema_name
    FROM public.tenants
""")
print(cur.fetchall())
conn.close()
