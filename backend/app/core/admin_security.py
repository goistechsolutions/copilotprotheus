"""Middleware / dependency para proteger rotas admin via JWT cookie"""
from fastapi import HTTPException, Cookie
from typing import Optional
import jwt
import os

JWT_ALGORITHM = "HS256"


def _get_jwt_secret() -> str:
    secret = os.environ.get("ADMIN_JWT_SECRET", "").strip()
    if not secret:
        secret = "elitecorp-admin-secret-change-in-prod"
    return secret


async def require_admin(admin_token: Optional[str] = Cookie(default=None)):
    """Dependency FastAPI — valida JWT cookie do admin"""
    if not admin_token:
        raise HTTPException(status_code=401, detail="Token de admin ausente")
    try:
        payload = jwt.decode(admin_token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=403, detail="Acesso negado")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
