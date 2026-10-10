"""Admin JWT Authentication Routes"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Depends
from pydantic import BaseModel
import jwt
import os
import hmac
import uuid
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import get_db
from app.core.admin_security import JWT_ISSUER, _admin_access_claims

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


def _clean_env(val: str, default: str = "") -> str:
    if not val:
        return default
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val or default


def get_admin_credentials():
    user = _clean_env(os.environ.get("ADMIN_USER"))
    pwd = _clean_env(os.environ.get("ADMIN_PASSWORD"))
    secret = _clean_env(os.environ.get("ADMIN_JWT_SECRET"))
    if not user or not pwd or len(secret) < 32:
        raise RuntimeError("Credenciais administrativas não configuradas com segurança.")
    return user, pwd, secret


def create_admin_token() -> str:
    _, _, secret = get_admin_credentials()
    issued_at = datetime.utcnow()
    expire = issued_at + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": "admin",
        "iss": JWT_ISSUER,
        "jti": str(uuid.uuid4()),
        "exp": expire,
        "iat": issued_at,
        **_admin_access_claims(),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> bool:
    if not token:
        return False
    try:
        _, _, secret = get_admin_credentials()
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "iss", "sub"]},
        )
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
async def login(
    request: LoginRequest,
    raw_request: Request,
    response: Response,
):
    admin_user = _clean_env(os.environ.get("ADMIN_USER"))
    admin_pass = _clean_env(os.environ.get("ADMIN_PASSWORD"))
    secret = _clean_env(os.environ.get("ADMIN_JWT_SECRET"))

    if not secret or len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Autenticação administrativa indisponível: credenciais não configuradas.",
        )

    req_user = (request.username or "").strip()
    req_pass = (request.password or "").strip()

    authenticated = False

    # 1. Autenticação via variáveis de ambiente (se configuradas)
    if admin_user and admin_pass:
        user_ok = hmac.compare_digest(req_user.lower(), admin_user.lower())
        pass_ok = hmac.compare_digest(req_pass, admin_pass)
        if user_ok and pass_ok:
            authenticated = True

    # 2. Autenticação via banco de dados (public.users com is_platform_admin = true)
    if not authenticated and req_user and req_pass:
        db = None
        try:
            from app.db.database import SessionLocal
            db = SessionLocal()
            req_hash = hashlib.sha256(req_pass.encode("utf-8")).hexdigest()
            user_row = db.execute(
                text("""
                    SELECT id, email, password_hash, is_platform_admin, status
                    FROM public.users
                    WHERE LOWER(email) = LOWER(:email)
                      AND is_platform_admin = true
                      AND UPPER(status) = 'ACTIVE'
                    LIMIT 1
                """),
                {"email": req_user},
            ).mappings().first()

            if user_row:
                stored_hash = user_row.get("password_hash") or ""
                if stored_hash and hmac.compare_digest(req_hash, stored_hash):
                    authenticated = True
        except Exception:
            pass
        finally:
            if db is not None:
                db.close()

    if not authenticated:
        # Se nem env nem banco possuem admin configurado
        has_env_admin = bool(admin_user and admin_pass)
        has_db_admin = False
        db = None
        try:
            from app.db.database import SessionLocal
            db = SessionLocal()
            db_admin = db.execute(
                text("SELECT 1 FROM public.users WHERE is_platform_admin = true AND UPPER(status) = 'ACTIVE' LIMIT 1")
            ).scalar()
            has_db_admin = bool(db_admin)
        except Exception:
            pass
        finally:
            if db is not None:
                db.close()

        if not has_env_admin and not has_db_admin:
            raise HTTPException(
                status_code=503,
                detail="Autenticação administrativa indisponível: credenciais não configuradas.",
            )
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    try:
        # Garante criação de token admin com segredo válido
        issued_at = datetime.utcnow()
        expire = issued_at + timedelta(hours=TOKEN_EXPIRE_HOURS)
        payload = {
            "sub": "admin",
            "admin_user": req_user,
            "iss": JWT_ISSUER,
            "jti": str(uuid.uuid4()),
            "exp": expire,
            "iat": issued_at,
            **_admin_access_claims(),
        }
        token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    except Exception:
        raise HTTPException(status_code=503, detail="Escopo administrativo não configurado com segurança.")

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
    try:
        secret = _clean_env(os.environ.get("ADMIN_JWT_SECRET"))
        payload = jwt.decode(
            admin_token,
            secret,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "iss", "sub"]},
        )
        user_name = payload.get("admin_user") or os.environ.get("ADMIN_USER") or "admin"
    except Exception:
        user_name = os.environ.get("ADMIN_USER") or "admin"
    return {"authenticated": True, "user": user_name}
