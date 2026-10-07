import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath("."))
load_dotenv("../.env")

from app.db.database import SessionLocal
from app.services.company_module_service import list_companies

db = SessionLocal()
try:
    items = list_companies(db, tenant_id="rodol")
    print("ITEMS:")
    print(items)
except Exception as e:
    import traceback
    traceback.print_exc()
db.close()
