from app.db.database import ensure_tenant_tables
from app.db.database import SessionLocal
import sys

db = SessionLocal()
try:
    db.execute("INSERT INTO public.tenants (tenant_code, tenant_name, schema_name, status) VALUES ('rodol', 'Rodol', 'rodol', 'ACTIVE') ON CONFLICT DO NOTHING")
    db.commit()
    ensure_tenant_tables(db, "rodol")
    db.commit()
    print("Tables created.")
except Exception as e:
    print(f"Error: {e}")
