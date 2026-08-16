from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy import text
from app.db.database import SessionLocal
import time

_CACHE = {"origins": set(), "expires_at": 0}
CACHE_TTL_SECONDS = 60

def _normalize_origin(value):
    if not value:
        return None
    return value.strip().rstrip("/")

def get_allowed_origins():
    now = time.time()
    if now < _CACHE["expires_at"]:
        return _CACHE["origins"]
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT frontend_domain
            FROM public.tenant
            WHERE frontend_domain IS NOT NULL
              AND status = 'active'
        """)).fetchall()
        origins = {_normalize_origin(row[0]) for row in rows if _normalize_origin(row[0])}
        _CACHE["origins"] = origins
        _CACHE["expires_at"] = now + CACHE_TTL_SECONDS
        return origins
    except Exception as e:
        print(f"Erro ao buscar origens: {e}")
        return _CACHE["origins"]
    finally:
        db.close()

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = _normalize_origin(request.headers.get("origin"))
        allowed_origins = get_allowed_origins()
        
        # Opcional: Adicionar origens fixas baseadas no app.main
        allowed_origins.update({
            "https://copilot.elitecorp.tec.br",
            "https://copilot-api.elitecorp.tec.br",
            "https://copilot-admin.elitecorp.tec.br",
            "https://copilotprotheus.pages.dev",
            "https://rodolltda195384.protheus.cloudtotvs.com.br:10703",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8000"
        })

        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)
            
        if origin and (origin in allowed_origins or "*" in allowed_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, X-Tenant-Id, X-Company-Id"
            response.headers["Vary"] = "Origin"
            
        return response
