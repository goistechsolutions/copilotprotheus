"""Ponto de entrada da API FastAPI — CopilotProtheus."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import engine, Base
from app.routers import auth, chat, health, tenants, users

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown da aplicação."""
    logger.info("🚀 CopilotProtheus API iniciando...")
    # Cria tabelas se não existirem (desenvolvimento)
    # Em produção use: alembic upgrade head
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Banco de dados pronto.")
    yield
    logger.info("🛑 CopilotProtheus API encerrando...")


app = FastAPI(
    title="CopilotProtheus API",
    description="Agente IA especialista em TOTVS Protheus",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["tenants"])
