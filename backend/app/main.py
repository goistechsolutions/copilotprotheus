import os
import logging
from fastapi import FastAPI, Depends, HTTPException, status
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
from app.api.infra_routes import router as infra_router
from app.api.agent_routes import router as agent_router
from app.api.admin_auth import router as admin_auth_router
from app.api.powerbi_routes import router as powerbi_router
from app.api.leonardo_routes import router as leonardo_router
from app.core.admin_security import require_admin
from app.api.agent_sql_routes import router as agent_sql_router
from app.core.logging_config import setup_logging
from app.db.database import get_db, engine, Base
from app.core.config import settings
from app.core.auth import get_current_user, get_current_user_flexible
import app.models.knowledge
import app.models.catalog_v52
import sentry_sdk

# Inicializa logging JSON estruturado
setup_logging()
logger = logging.getLogger("app.main")
logger.info("Iniciando a aplicação FastAPI...")

# Cria as tabelas se não existirem no startup
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        except Exception:
            try: conn.rollback()
            except: pass
        
        migrations = [
            "CREATE TABLE IF NOT EXISTS tenants (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), protheus_rest_url VARCHAR(1024), auth_mode VARCHAR(50) DEFAULT 'basic', system_prompt TEXT, temperature FLOAT DEFAULT 0.7, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ);",
            "ALTER TABLE tenants ALTER COLUMN id TYPE VARCHAR(100);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name VARCHAR(255);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(100);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_name VARCHAR(255);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS protheus_rest_url VARCHAR(1024);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS protheus_user VARCHAR(255);",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_protheus_password TEXT;",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auth_mode VARCHAR(50) DEFAULT 'basic';",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS system_prompt TEXT;",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7;",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';",
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_code VARCHAR(50);",
            "UPDATE tenants SET tenant_code = id WHERE tenant_code IS NULL;",
            "UPDATE tenants SET tenant_name = name WHERE tenant_name IS NULL;",
            "UPDATE tenants SET name = tenant_name WHERE name IS NULL;",
            
            "CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100), cnpj VARCHAR(30), razao_social VARCHAR(255), status VARCHAR(50) DEFAULT 'ativa', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(30);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS ie VARCHAR(30);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS telefone VARCHAR(50);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS endereco VARCHAR(500);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_grupo VARCHAR(20);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_empresa VARCHAR(20);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_unidade VARCHAR(20);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_filial VARCHAR(30);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_ambientes VARCHAR(100) DEFAULT 'producao';",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_usuario VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_password VARCHAR(255);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_rest_url VARCHAR(1024);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_webapp_url VARCHAR(1024);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS licenca_uso TEXT;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ativa';",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(60);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_env VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS protheus_branch VARCHAR(100);",
            "UPDATE companies SET company_code = cnpj WHERE company_code IS NULL AND cnpj IS NOT NULL;",
            "UPDATE companies SET company_name = razao_social WHERE company_name IS NULL AND razao_social IS NOT NULL;",
            "UPDATE companies SET razao_social = company_name WHERE razao_social IS NULL AND company_name IS NOT NULL;",
            "UPDATE companies SET cnpj = company_code WHERE cnpj IS NULL AND company_code IS NOT NULL;",

            "CREATE TABLE IF NOT EXISTS agent_users (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100) DEFAULT 'default' NOT NULL, username VARCHAR(100) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);",
            "CREATE TABLE IF NOT EXISTS agent_roles (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100) DEFAULT 'default' NOT NULL, name VARCHAR(50) NOT NULL, permissions JSON, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);",
            "CREATE TABLE IF NOT EXISTS tenant_connectors (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, environment VARCHAR(100) DEFAULT 'producao' NOT NULL, rest_url VARCHAR(1024) NOT NULL, auth_mode VARCHAR(50) DEFAULT 'basic', username VARCHAR(255), password_hash TEXT, token TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ);",

            "ALTER TABLE agent_users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default';",
            "ALTER TABLE agent_roles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default';",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'tenant' NOT NULL;",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'tenant' NOT NULL;",
            "ALTER TABLE memories ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'tenant' NOT NULL;",
            
            "CREATE TABLE IF NOT EXISTS tenant_dictionary_sources (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', source_type VARCHAR(20) NOT NULL, snapshot_code VARCHAR(60) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), started_at TIMESTAMPTZ NULL, finished_at TIMESTAMPTZ NULL, error_message TEXT NULL);",
            "CREATE TABLE IF NOT EXISTS dictionary_tables (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', snapshot_code VARCHAR(60) NOT NULL, table_name VARCHAR(30) NOT NULL, table_alias VARCHAR(80) NULL, module_code VARCHAR(10) NULL, description TEXT NULL, physical_name VARCHAR(80) NULL, active_flag BOOLEAN NOT NULL DEFAULT TRUE, raw_payload JSONB NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, snapshot_code, table_name));",
            "CREATE TABLE IF NOT EXISTS dictionary_fields (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', snapshot_code VARCHAR(60) NOT NULL, table_name VARCHAR(30) NOT NULL, field_name VARCHAR(30) NOT NULL, title VARCHAR(120) NULL, field_type VARCHAR(5) NULL, length_num INTEGER NULL, decimal_num INTEGER NULL, required_flag BOOLEAN NOT NULL DEFAULT FALSE, browse_flag BOOLEAN NOT NULL DEFAULT FALSE, virtual_flag BOOLEAN NOT NULL DEFAULT FALSE, validation_rule TEXT NULL, relation_rule TEXT NULL, when_rule TEXT NULL, raw_payload JSONB NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, snapshot_code, table_name, field_name));",
            "CREATE TABLE IF NOT EXISTS dictionary_indexes (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', snapshot_code VARCHAR(60) NOT NULL, table_name VARCHAR(30) NOT NULL, index_order VARCHAR(10) NOT NULL, nickname VARCHAR(80) NULL, expression TEXT NULL, raw_payload JSONB NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, snapshot_code, table_name, index_order));",
            "CREATE TABLE IF NOT EXISTS dictionary_groups (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', snapshot_code VARCHAR(60) NOT NULL, group_name VARCHAR(80) NOT NULL, description TEXT NULL, raw_payload JSONB NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, snapshot_code, group_name));",
            "CREATE TABLE IF NOT EXISTS tenant_table_permissions (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', role_id VARCHAR(100) NOT NULL, table_name VARCHAR(30) NOT NULL, can_list BOOLEAN NOT NULL DEFAULT FALSE, can_describe BOOLEAN NOT NULL DEFAULT FALSE, can_query BOOLEAN NOT NULL DEFAULT FALSE, approved_by VARCHAR(100) NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, role_id, table_name));",
            "CREATE TABLE IF NOT EXISTS tenant_field_permissions (id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(100) NOT NULL, company_id VARCHAR(100) NULL, environment_id VARCHAR(100) NOT NULL DEFAULT 'producao', role_id VARCHAR(100) NOT NULL, table_name VARCHAR(30) NOT NULL, field_name VARCHAR(30) NOT NULL, can_select BOOLEAN NOT NULL DEFAULT FALSE, can_filter BOOLEAN NOT NULL DEFAULT FALSE, masked_flag BOOLEAN NOT NULL DEFAULT FALSE, approved_by VARCHAR(100) NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (tenant_id, environment_id, role_id, table_name, field_name));",
            "CREATE TABLE IF NOT EXISTS protheus_modules_master (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_code VARCHAR(30) NOT NULL UNIQUE, module_name VARCHAR(120) NOT NULL, source_name VARCHAR(50) NOT NULL DEFAULT 'SYS_USR_MODULE', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NULL);",
            "CREATE TABLE IF NOT EXISTS tenant_module_contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, contract_id UUID NOT NULL, module_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'allowed', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
            "CREATE TABLE IF NOT EXISTS tenant_allowed_tables (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, contract_id UUID NOT NULL, snapshot_id UUID NOT NULL, table_id UUID NOT NULL, access_level VARCHAR(20) NOT NULL DEFAULT 'query', allowed BOOLEAN NOT NULL DEFAULT TRUE, rationale VARCHAR(255) NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NULL);",
            "CREATE INDEX IF NOT EXISTS idx_dictionary_tables_lookup ON dictionary_tables (tenant_id, environment_id, table_name);",
            "CREATE INDEX IF NOT EXISTS idx_dictionary_fields_lookup ON dictionary_fields (tenant_id, environment_id, table_name, field_name);",
            "CREATE INDEX IF NOT EXISTS idx_perm_table_lookup ON tenant_table_permissions (tenant_id, environment_id, role_id, table_name);",
            "CREATE INDEX IF NOT EXISTS idx_perm_field_lookup ON tenant_field_permissions (tenant_id, environment_id, role_id, table_name, field_name);"
        ]
        for query in migrations:
            try:
                conn.execute(text(query))
                conn.commit()
            except Exception:
                try: conn.rollback()
                except: pass
                
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

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

app = FastAPI(title="Copilot Protheus Integration", version="1.0.0")

# Suporte a Proxy Headers (Nginx / Cloudflare) para manter esquema HTTPS em redirects e URLs
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# Middleware para forçar esquema HTTPS quando acessado via proxy reverso (evita 307 redirect para http://)
@app.middleware("http")
async def enforce_https_scheme_middleware(request, call_next):
    proto = request.headers.get("x-forwarded-proto", "")
    if proto.lower() == "https":
        request.scope["scheme"] = "https"
    response = await call_next(request)
    return response

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
from app.api.auth_routes import router as auth_router
from app.api.governance_routes import router as governance_router
from app.api.catalog_v52_routes import router as catalog_v52_router
from fastapi.staticfiles import StaticFiles

app.include_router(router)
app.include_router(knowledge_router, prefix="/api")
app.include_router(integration_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(tenant_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(admin_auth_router)
app.include_router(governance_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(agent_sql_router, prefix="/api")
app.include_router(catalog_v52_router)
app.include_router(infra_router)
# --- Fase 4: Power BI + Leonardo AI ---
app.include_router(powerbi_router)   # prefixo já definido em powerbi_routes.py  (/api/powerbi)
app.include_router(leonardo_router)  # prefixo já definido em leonardo_routes.py (/api/leonardo)

import httpx
from fastapi import Request
from fastapi.responses import Response
from datetime import datetime

# ─── Dashboard Stats ──────────────────────────────────────────────────────────
@app.get("/api/admin/dashboard/stats")
async def dashboard_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Métricas gerais do painel admin EliteCorp"""
    try:
        tenants = db.execute(text("SELECT COUNT(*) FROM tenants")).scalar() or 0
    except Exception:
        tenants = 0
    try:
        users = db.execute(text("SELECT COUNT(*) FROM agent_users")).scalar() or 0
    except Exception:
        users = 0
    try:
        rag_docs = db.execute(text("SELECT COUNT(*) FROM documents")).scalar() or 0
    except Exception:
        rag_docs = 0
    try:
        today = datetime.utcnow().date()
        conversations = db.execute(
            text("SELECT COUNT(DISTINCT session_id) FROM memories WHERE DATE(created_at) = :today"),
            {"today": today}
        ).scalar() or 0
    except Exception:
        conversations = 0

    return {
        "tenants": tenants,
        "users": users,
        "rag_documents": rag_docs,
        "conversations_today": conversations,
        "avg_response_ms": None,
        "uptime": "100%",
    }

# Proxy for Adminer
@app.api_route("/adminer/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
async def adminer_proxy(request: Request, path: str, current_user: dict = Depends(get_current_user_flexible)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: apenas administradores podem acessar o Adminer."
        )

    adminer_url = f"http://adminer:8080/{path}"
    async with httpx.AsyncClient() as client:
        params = request.query_params
        body = await request.body()
        proxy_req = client.build_request(
            request.method,
            adminer_url,
            params=params,
            headers={k: v for k, v in request.headers.items() if k.lower() != 'host'},
            content=body
        )
        try:
            proxy_res = await client.send(proxy_req, stream=True)
            headers = dict(proxy_res.headers)
            for h in ["x-frame-options","content-security-policy","X-Frame-Options","Content-Security-Policy","transfer-encoding","content-encoding","content-length","connection","keep-alive"]:
                headers.pop(h, None)
            return Response(
                content=await proxy_res.aread(),
                status_code=proxy_res.status_code,
                headers=headers
            )
        except Exception as e:
            logger.error(f"Erro no proxy do adminer: {e}")
            return JSONResponse(status_code=502, content={"detail": f"Erro de proxy: {e}"})

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
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "healthy"}
    except Exception as e:
        logger.error(f"Falha no health check: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "database": f"unhealthy: {str(e)}"}
        )
