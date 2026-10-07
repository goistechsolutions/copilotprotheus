import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT schema_name FROM information_schema.schemata")
for row in cur.fetchall():
    print(row)
conn.close()
