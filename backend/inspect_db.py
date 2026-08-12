import sys, os
sys.path.append(os.getcwd())
from app.db.database import SessionLocal, engine
from sqlalchemy import text
with engine.connect() as conn:
    res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema='rodol_prod' AND table_name='dictionary_tables'"))
    for row in res:
        print(row[0])
