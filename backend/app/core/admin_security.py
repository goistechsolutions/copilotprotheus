"""Middleware / dependency para proteger rotas admin via JWT cookie ou Basic Auth"""
from fastapi import HTTPException, Cookie, Depends, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from typing import Optional
import jwt
import os
import hmac

security = HTTPBasic(auto_error=False)
JWT_ALGORITHM = "HS256"


def _get_jwt_secret() -> str:
    secret = os.environ.get("ADMIN_JWT_SECRET", "").strip()
    if not secret:
        secret = "elitecorp-admin-secret-change-in-prod"
    return secret


async def require_admin(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None)
):
    """Dependency FastAPI — valida JWT cookie ou HTTP Basic Auth do admin"""
    # 1. Valida Cookie JWT se presente
    if admin_token:
        try:
            payload = jwt.decode(admin_token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("sub") == "admin":
                return payload
        except Exception:
            pass

    # 2. Valida HTTP Basic Auth se presente nos cabeçalhos
    if credentials:
        admin_user = os.environ.get("ADMIN_USER", "admin").strip()
        admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123").strip()
        user_ok = hmac.compare_digest(credentials.username.strip().lower(), admin_user.lower())
        pass_ok = hmac.compare_digest(credentials.password.strip(), admin_pass)
        if user_ok and pass_ok:
            return {"sub": credentials.username}

    raise HTTPException(status_code=401, detail="Sessão não autenticada ou token ausente. Faça login novamente.")


async def require_admin_flexible(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None)
):
    try:
        return await require_admin(credentials, admin_token)
    except Exception:
        return None
