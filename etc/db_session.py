"""
db_session.py
Camada de resolução dinâmica de schema por requisição (multi-tenant via search_path).
"""
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/copilot_protheus"

engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


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
