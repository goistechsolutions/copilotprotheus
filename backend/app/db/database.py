from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Header
import os
import re

DATABASE_URL = os.getenv('DATABASE_URL', '')
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ensure_tenant_tables(db, clean_tenant: str):
    if not clean_tenant or clean_tenant == "public":
        return
    try:
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".protheus_modules (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                usr_modulo VARCHAR(50) NOT NULL,
                usr_codmod VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_tenant ON "{clean_tenant}".protheus_modules (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_codmod ON "{clean_tenant}".protheus_modules (usr_codmod);
        """))
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_schemas (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                modulo VARCHAR(50),
                chave VARCHAR(10) NOT NULL,
                tabela VARCHAR(50),
                nome VARCHAR(255),
                schema_json JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_tenant ON "{clean_tenant}".tenant_schemas (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_modulo ON "{clean_tenant}".tenant_schemas (modulo);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_chave ON "{clean_tenant}".tenant_schemas (chave);
        """))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB] Erro ao garantir tabelas no schema '{clean_tenant}': {e}")

def get_db(x_tenant_id: str = Header("default")):
    db = SessionLocal()
    
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', x_tenant_id)
    if not clean_tenant:
        clean_tenant = "default"
        
    try:
        if clean_tenant != "public":
            try:
                db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
                db.commit()
            except Exception:
                db.rollback()
                
            ensure_tenant_tables(db, clean_tenant)
            
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        
        yield db
    finally:
        try:
            db.execute(text("SET search_path TO public"))
            db.commit()
        except Exception:
            pass
        db.close()
