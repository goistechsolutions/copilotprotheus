import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT tenant_code, schema_name FROM public.tenants")
print("Tenants:", cur.fetchall())

cur.execute("SELECT id, company_code, branch_code, legal_name, tax_id, status FROM rodol.companies")
print("Companies:", cur.fetchall())

conn.close()
