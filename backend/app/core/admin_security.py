"""Middleware / dependency para proteger rotas admin via JWT cookie"""
from fastapi import HTTPException, Cookie
from typing import Optional
import jwt
import os

JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "elitecorp-admin-secret-change-in-prod")
JWT_ALGORITHM = "HS256"


async def require_admin(admin_token: Optional[str] = Cookie(default=None)):
    """Dependency FastAPI - valida JWT cookie do admin"""
    if not admin_token:
        raise HTTPException(status_code=401, detail="Token de admin ausente")
    try:
        payload = jwt.decode(admin_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=403, detail="Acesso negado")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
