"""
db_session.py
Camada de resolução dinâmica de schema por requisição (multi-tenant via search_path).
"""
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

import os

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5435")
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "sap_password_123")
    db_name = os.getenv("DB_NAME", "copilot_protheus")
    DATABASE_URL = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)

try:
    from sqlalchemy.ext.asyncio import async_sessionmaker
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
except ImportError:
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def get_tenant_session(schema_name: str):
    """
    Abre uma sessão com search_path fixado para o schema do tenant.
    IMPORTANTE: cada conexão do pool precisa resetar o search_path ao ser devolvida,
    para não "vazar" o schema de um tenant para a próxima requisição que reutilizar a conexão.
    """
    session = SessionLocal()
    try:
        await session.execute(text(f'SET search_path TO "{schema_name}", public'))
        yield session
    finally:
        await session.execute(text("SET search_path TO public"))
        await session.close()


async def get_public_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        await session.close()
