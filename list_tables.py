import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')")
for row in cur.fetchall():
    print(row)
conn.close()
