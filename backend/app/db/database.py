from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Header
import os
import re

DATABASE_URL = os.getenv('DATABASE_URL', '')
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db(x_tenant_id: str = Header("default")):
    db = SessionLocal()
    
    # Sanitiza o tenant_id para aceitar apenas caracteres alfanuméricos e underscore
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', x_tenant_id)
    if not clean_tenant:
        clean_tenant = "default"
        
    try:
        if clean_tenant != "public" and clean_tenant != "default":
            # Habilita pgvector em public para estar disponível em todos os schemas
            db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
            db.commit()
            
            # Cria o schema do tenant se não existir
            db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
            db.commit()
            
            # Define temporariamente o search_path
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
            db.commit()
            
            # Importa modelos dinamicamente para evitar import circular e registrar na Base
            import app.models.knowledge
            Base.metadata.create_all(bind=db.connection())
            db.commit()
            
        # Define search_path ativo para o ciclo da requisição
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
