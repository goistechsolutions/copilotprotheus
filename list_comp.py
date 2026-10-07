import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath("backend"))
load_dotenv(".env")

from app.db.database import SessionLocal
from app.services.company_module_service import list_companies

db = SessionLocal()
items = list_companies(db, tenant_id=None)
print("ITEMS:")
print(items)
db.close()
