import os
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.routes import router
from app.api.knowledge_routes import router as knowledge_router
from app.api.integration_routes import router as integration_router
from app.api.report_routes import router as report_router
from app.api.company_routes import router as company_router
from app.api.tenant_routes import router as tenant_router
from app.core.logging_config import setup_logging
from app.db.database import get_db, engine, Base
from app.core.config import settings
import app.models.knowledge
import sentry_sdk

# Inicializa logging JSON estruturado
setup_logging()
logger = logging.getLogger("app.main")
logger.info("Iniciando a aplicação FastAPI...")

# Cria as tabelas se não existirem no startup
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    logger.info("Tabelas do banco de dados verificadas/criadas com sucesso com suporte a pgvector.")
except Exception as e:
    logger.error(f"Erro ao criar tabelas: {e}")


# Inicializa Sentry se DSN fornecida
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=1.0,
    )
    logger.info("Sentry integrado com sucesso!")

app = FastAPI(title="Copilot Protheus Integration", version="1.0.0")

# Lê as origens do CORS a partir da env var, padrão é '*'
allowed_origins = os.getenv("CORS_ORIGIN", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
from app.api.admin_routes import router as admin_router
from fastapi.staticfiles import StaticFiles

app.include_router(router)
app.include_router(knowledge_router, prefix="/api")
app.include_router(integration_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(tenant_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")

# Mount admin frontend
os.makedirs("static/admin", exist_ok=True)
app.mount("/admin", StaticFiles(directory="static/admin", html=True), name="admin")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Erro não tratado na rota {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Por favor, tente novamente mais tarde."}
    )

from fastapi.responses import RedirectResponse

@app.get("/")
def read_root():
    return RedirectResponse(url="/api/launch")

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        # Executa query rápida de ping no banco
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "healthy"}
    except Exception as e:
        logger.error(f"Falha no health check: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "database": f"unhealthy: {str(e)}"}
        )
