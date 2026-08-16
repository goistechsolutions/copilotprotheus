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
from app.api.agent.routes import router as agent_router_v2
from app.core.admin_security import require_admin
from app.api.agent_sql_routes import router as agent_sql_router
from app.core.logging_config import setup_logging
from app.db.database import get_db, engine, Base, ensure_public_tables, ensure_all_registered_tenant_schemas
from app.core.config import settings
from app.core.auth import get_current_user, get_current_user_flexible
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
        try:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
            conn.execute(text("SET search_path TO public"))
            conn.commit()
            ensure_public_tables(conn)
        except Exception as e_pub:
            logger.warning(f"Aviso ao garantir tabelas no schema public: {e_pub}")
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
            conn.commit()
        except Exception:
            try: conn.rollback()
            except: pass
        
        migrations = [
            "CREATE TABLE IF NOT EXISTS public.agent_users (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100) DEFAULT 'default' NOT NULL, username VARCHAR(100) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);",
            "CREATE TABLE IF NOT EXISTS public.agent_roles (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100) DEFAULT 'default' NOT NULL, name VARCHAR(50) NOT NULL, permissions JSON, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);",
            "ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default';",
            "ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default';",
            
            "CREATE TABLE IF NOT EXISTS public.protheus_modules_master (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_code VARCHAR(30) NOT NULL UNIQUE, module_name VARCHAR(120) NOT NULL, source_name VARCHAR(50) NOT NULL DEFAULT 'SYS_USR_MODULE', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NULL);",
            "CREATE TABLE IF NOT EXISTS public.tenant_module_contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, contract_id UUID NOT NULL, module_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'allowed', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
            
            # Limpeza de tabelas operacionais legadas criadas incorretamente no schema public
            "DROP TABLE IF EXISTS public.tenants, public.companies, public.connectors, public.tenant_connectors, public.tenant_dictionary_sources, public.dictionary_tables, public.dictionary_fields, public.dictionary_indexes, public.dictionary_groups, public.tenant_table_permissions, public.tenant_field_permissions, public.tenant_allowed_tables, public.tenant_allowed_fields, public.tenant_dictionary_tables, public.tenant_dictionary_fields, public.tenant_dictionary_indexes, public.dictionary_snapshots CASCADE;"
        ]
        for query in migrations:
            try:
                conn.execute(text(query))
                conn.commit()
            except Exception:
                try: conn.rollback()
                except: pass
                
        conn.execute(text("SET search_path TO public"))
        ensure_public_tables(conn)
        try:
            ensure_all_registered_tenant_schemas(conn)
        except Exception as e_tenants:
            logger.warning(f"Aviso ao provisionar schemas de tenants cadastrados: {e_tenants}")
        conn.commit()
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

app = FastAPI(title="Copilot Protheus Integration", version="1.0.0", redirect_slashes=False)

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

# Configuração de CORS com suporte a domínios do Cloudflare e ambiente local
cors_origins_env = os.getenv("CORS_ORIGIN", "*")
if cors_origins_env == "*":
    # Em APIs com credenciais, o FastAPI não permite ["*"], então adicionamos regex flexível
    allowed_origins = []
else:
    allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

cloudflare_origins = [
    "https://copilot.elitecorp.tec.br",
    "https://copilot-api.elitecorp.tec.br",
    "https://copilot-admin.elitecorp.tec.br",
    "https://copilotprotheus.pages.dev",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8000"
]
for o in cloudflare_origins:
    if o not in allowed_origins and "*" not in allowed_origins:
        allowed_origins.append(o)

# Inicializa banco rapidamente apenas para pegar origens extras (se disponível)
try:
    from app.db.database import SessionLocal
    from sqlalchemy import text
    with SessionLocal() as db:
        rows = db.execute(text("SELECT frontend_domain FROM public.tenant WHERE frontend_domain IS NOT NULL AND status = 'active'")).fetchall()
        for row in rows:
            domain = row[0].strip().rstrip("/")
            if domain and domain not in allowed_origins:
                allowed_origins.append(domain)
except Exception as e:
    logger.warning(f"Não foi possível carregar domínios do banco para CORS no startup: {e}")

# Configura o Middleware Nativo do FastAPI/Starlette
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if cors_origins_env != "*" else [],
    allow_origin_regex="https?://.*" if cors_origins_env == "*" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
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
app.include_router(agent_router_v2)
app.include_router(catalog_v52_router)
app.include_router(infra_router)
# --- Fase 4: Power BI + Leonardo AI ---
app.include_router(powerbi_router)   # prefixo já definido em powerbi_routes.py  (/api/powerbi)
app.include_router(leonardo_router)  # prefixo já definido em leonardo_routes.py (/api/leonardo)

@app.get("/debug-db")
def debug_db_endpoint():
    import traceback
    try:
        from app.db.database import engine, ensure_public_tables
        from sqlalchemy import text
        with engine.connect() as conn:
            sql = """
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_registry') THEN
                    ALTER TABLE public.tenant_registry RENAME TO tenant;
                END IF;
            END $$;
            DELETE FROM public.app_bootstrap_flags;
            """
            conn.execute(text(sql))
            conn.commit()
            ensure_public_tables(conn, force=True)
            conn.commit()
        return {"success": True, "message": "All tables and migrations created successfully"}
    except Exception as e:
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


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
        tenants = db.execute(text("SELECT COUNT(*) FROM tenant")).scalar() or 0
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

# Mount admin frontend com fallback SPA (evita 404 em subrotas como /admin/login ou /admin/tenants)
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404 and not path.endswith(('.js', '.css', '.png', '.jpg', '.svg', '.ico', '.woff2', '.json', '.map')):
                return await super().get_response("index.html", scope)
            raise ex

os.makedirs("static/admin", exist_ok=True)

from fastapi.responses import FileResponse
import os

@app.get("/admin")
def serve_admin_no_slash():
    index_path = "static/admin/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(status_code=404, content={"detail": "Admin build not found"})

app.mount("/admin/", SPAStaticFiles(directory="static/admin", html=True), name="admin")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Erro não tratado na rota {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Por favor, tente novamente mais tarde."}
    )

from fastapi.responses import RedirectResponse

@app.get("/")
def read_root(request: Request):
    host = request.headers.get("host", "").lower()
    if "copilot-admin" in host or "admin" in host:
        return RedirectResponse(url="/admin")
    return RedirectResponse(url="/admin")

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
