import sys, os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from app.db.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
res = db.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'rodol_prod'")).fetchall()
print('Schema exists?', len(res) > 0)
if len(res) > 0:
    res = db.execute(text("SELECT count(*) FROM rodol_prod.dictionary_tables WHERE active_flag = true")).fetchall()
    print('Tables in rodol_prod:', res[0][0])
