"""Admin JWT Authentication Routes"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from pydantic import BaseModel
import jwt
import os

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

# ── Credenciais de desenvolvimento ──────────────────────────────────────
# Em produção, configure via variáveis de ambiente no docker-compose / .env
# Em desenvolvimento, o padrão é admin / admin123
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "elitecorp-admin-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8
COOKIE_NAME = "admin_token"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


def create_admin_token() -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": "admin", "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub") == "admin"
    except Exception:
        return False


def _is_https(request: Request) -> bool:
    """Detecta se a requisição chegou via HTTPS (diretamente ou via proxy/Cloudflare)."""
    if request.url.scheme == "https":
        return True
    # Headers comuns de proxies reversos (Cloudflare, nginx, etc.)
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return forwarded_proto.lower() == "https"


def _set_auth_cookie(response: Response, token: str, *, is_https: bool):
    """Seta o cookie JWT com atributos corretos para HTTP e HTTPS."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def _delete_auth_cookie(response: Response, *, is_https: bool):
    """Remove o cookie JWT usando os mesmos atributos do set para garantir exclusão."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=is_https,
        httponly=True,
        samesite="lax",
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, raw_request: Request, response: Response):
    if request.username != ADMIN_USER or request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_admin_token()
    _set_auth_cookie(response, token, is_https=_is_https(raw_request))
    return LoginResponse(success=True, message="Login realizado com sucesso")


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request, response: Response):
    _delete_auth_cookie(response, is_https=_is_https(request))
    return LoginResponse(success=True, message="Sessão encerrada")


@router.get("/me")
async def me(admin_token: str = Cookie(default=None)):
    if not admin_token or not verify_admin_token(admin_token):
        raise HTTPException(status_code=401, detail="Não autenticado")
    return {"authenticated": True, "user": ADMIN_USER}
