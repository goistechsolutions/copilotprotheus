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
from app.api.conversation_routes import router as conversation_router
from app.api.business_rules_routes import router as business_rules_router
from app.core.logging_config import (
    setup_logging,
    get_correlation_id,
    set_correlation_id,
    reset_correlation_id,
)
from app.db.database import get_db, engine, Base, ensure_public_tables, ensure_all_registered_tenant_schemas
from app.core.config import settings
from app.core.auth import get_current_user, get_current_user_flexible
import app.models.knowledge
import sentry_sdk

# Inicializa logging JSON estruturado
setup_logging()
logger = logging.getLogger("app.main")
logger.info("Iniciando a aplicação FastAPI...")

# Inicialização do banco: um único bootstrap idempotente e não destrutivo.
# O schema real é mantido em ``app.db.database``; este entrypoint não deve
# executar DDL paralelo nem apagar tabelas legadas durante o startup.
try:
    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        conn.execute(text("SET search_path TO public"))
        conn.commit()

        ensure_public_tables(conn)
        ensure_all_registered_tenant_schemas(conn)
        conn.execute(text("SET search_path TO public"))
        conn.commit()

    logger.info(
        "Tabelas do banco verificadas/criadas com bootstrap idempotente e suporte a pgvector."
    )
except Exception as exc:
    logger.error("Erro ao inicializar o banco de dados: %s", type(exc).__name__)


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


@app.middleware("http")
async def correlation_id_middleware(request, call_next):
    """Mantém um identificador seguro durante toda a requisição e seus tasks."""
    correlation_id = request.headers.get("X-Correlation-ID")
    context_token = set_correlation_id(correlation_id)
    active_correlation_id = get_correlation_id()
    request.state.correlation_id = active_correlation_id
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = active_correlation_id
        return response
    finally:
        reset_correlation_id(context_token)

# Configuração de CORS com suporte a domínios do Cloudflare e ambiente local
cors_origins_env = os.getenv("CORS_ORIGIN", "*")
if cors_origins_env == "*":
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
    allow_origins=allowed_origins,
    allow_origin_regex="https?://.*" if cors_origins_env == "*" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
from app.api.admin_routes import router as admin_router
from app.api.admin_billing_routes import router as admin_billing_router
from app.api.auth_routes import router as auth_router
from app.api.governance_routes import router as governance_router
from app.api.business_governance_routes import router as business_governance_router
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
app.include_router(admin_billing_router, prefix="/api/admin")
app.include_router(admin_auth_router)
app.include_router(governance_router, prefix="/api")
app.include_router(business_governance_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
# O fluxo /api/agent/ask/v2 é atendido exclusivamente por agent_sql_routes,
# que exige tenant+ambiente e delega a execução ao cliente QueryRest OAuth2.
app.include_router(agent_sql_router, prefix="/api")
app.include_router(catalog_v52_router)
app.include_router(infra_router)
app.include_router(conversation_router)
app.include_router(business_rules_router, prefix="/api")
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
        # agent_users era uma tabela legada e pode não existir após a
        # reconstrução do schema. O cadastro canônico de usuários é public.users.
        users = db.execute(text("SELECT COUNT(*) FROM public.users")).scalar() or 0
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
