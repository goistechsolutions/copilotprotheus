import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("""
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'rodol_prd' AND table_name = 'user_company_access'
""")
print(cur.fetchall())
conn.close()
