import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath("backend"))
load_dotenv(".env")

from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Atualizando rotas de company_routes para povoar user_company_access...")
    # Update logic goes here or use replace_file_content...
finally:
    db.close()
