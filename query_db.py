import sqlite3
import json

def fetch_tables():
    con = sqlite3.connect('backend/copilot.db')
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row['name'] for row in cur.fetchall()]
    print("Tables:", tables)
    
    if "tenant_schema.dictionary_fields" in tables:
        pass
    else:
        # Check schemas or anything? SQLite doesn't have true schemas.
        # It's probably `dictionary_fields` and `tenant_id` is a column? No, SQLAlchemy creates them.
        cur.execute("SELECT * FROM \"dictionary_fields\" WHERE field_name = 'C5_XNOME'")
        print("Without schema:", cur.fetchall())

fetch_tables()
