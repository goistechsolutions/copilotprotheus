import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'company_info'")
print(cur.fetchall())
conn.close()
