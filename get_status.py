import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("""
    SELECT status FROM public.tenants WHERE tenant_code = 'rodol'
""")
print(cur.fetchall())
conn.close()
