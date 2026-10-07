import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.abspath("backend"))
load_dotenv(".env")

from app.db.database import SessionLocal
from app.services.company_module_service import list_companies

db = SessionLocal()
try:
    print("Listing for rodol_prd...")
    print(list_companies(db, "rodol_prd"))
    print("Listing for rodol...")
    print(list_companies(db, "rodol"))
finally:
    db.close()
