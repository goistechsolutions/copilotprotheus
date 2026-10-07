import psycopg2
from pathlib import Path

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"

print("Connecting...")
conn = psycopg2.connect(dsn)
conn.autocommit = True
cur = conn.cursor()

print("Creating extension vector...")
cur.execute("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;")

scripts = [
    "database/bootstrap/01_public_control_plane.sql",
    "database/bootstrap/02_tenant_schema_factory.sql",
    "database/bootstrap/03_seed_data.sql"
]

for script in scripts:
    print(f"Executing {script}...")
    sql = Path(script).read_text(encoding="utf-8")
    # Some scripts might have multiple statements separated by ;
    cur.execute(sql)

print("SUCCESS")
conn.close()
