import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT tenant_code, schema_name FROM public.tenants")
print("Tenants:", cur.fetchall())

conn.close()
