import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.database import SessionLocal
from sqlalchemy import text

with open('database/bootstrap/02_tenant_schema_factory.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

db = SessionLocal()
try:
    db.execute(text(sql))
    db.commit()
    print("Function provision_tenant_schema updated successfully.")
except Exception as e:
    db.rollback()
    print("Error:", e)
finally:
    db.close()
