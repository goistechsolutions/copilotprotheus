import sys
sys.path.append("backend")

from app.db.database import ensure_tenant_tables, SessionLocal

db = SessionLocal()
ensure_tenant_tables(db, "rodol")
db.commit()
print("Tables created.")
