import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import engine
from sqlalchemy import text

def run_migration():
    print("-> Executando migracao de DDL para a tabela companies...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_rest_url VARCHAR(1024);"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_webapp_url VARCHAR(1024);"))
            conn.commit()
            print("[OK] Migracao concluida com sucesso!")
        except Exception as e:
            print(f"[ERRO] Falha ao rodar migracao: {e}")

if __name__ == "__main__":
    run_migration()
