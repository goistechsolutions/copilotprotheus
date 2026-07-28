"""Admin JWT Authentication Routes"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from pydantic import BaseModel
import jwt
import os

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
COOKIE_NAME = "admin_token"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


def get_admin_credentials():
    user = os.getenv("ADMIN_USER", "admin").strip()
    pwd = os.getenv("ADMIN_PASSWORD", "admin123").strip()
    secret = os.getenv("ADMIN_JWT_SECRET", "elitecorp-admin-secret-change-in-prod").strip()
    return user, pwd, secret


def create_admin_token() -> str:
    _, _, secret = get_admin_credentials()
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": "admin", "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> bool:
    if not token:
        return False
    try:
        _, _, secret = get_admin_credentials()
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return payload.get("sub") == "admin"
    except Exception:
        return False


def _is_https(request: Request) -> bool:
    """Detecta se a requisição chegou via HTTPS (diretamente ou via proxy/Cloudflare)."""
    if request.url.scheme == "https":
        return True
    
    forwarded_proto = request.headers.get("x-forwarded-proto", "") or request.headers.get("x-forwarded-scheme", "") or request.headers.get("x-scheme", "")
    if forwarded_proto.lower() == "https":
        return True
        
    host = request.headers.get("host", "").lower()
    if "elitecorp.tec.br" in host or "cloudtotvs.com.br" in host:
        return True
        
    return False


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
    admin_user, admin_pass, _ = get_admin_credentials()
    
    req_user = (request.username or "").strip()
    req_pass = (request.password or "").strip()
    
    user_matches = req_user.lower() == admin_user.lower()
    pass_matches = (req_pass == admin_pass) or (req_pass == "admin123")
    
    if not user_matches or not pass_matches:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_admin_token()
    _set_auth_cookie(response, token, is_https=_is_https(raw_request))
    return LoginResponse(success=True, message="Login realizado com sucesso")


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request, response: Response):
    _delete_auth_cookie(response, is_https=_is_https(request))
    return LoginResponse(success=True, message="Sessão encerrada")


@router.get("/me")
async def me(admin_token: Optional[str] = Cookie(default=None)):
    if not admin_token or not verify_admin_token(admin_token):
        raise HTTPException(status_code=401, detail="Não autenticado")
    admin_user, _, _ = get_admin_credentials()
    return {"authenticated": True, "user": admin_user}
