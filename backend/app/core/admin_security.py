"""Middleware / dependency para proteger rotas admin via JWT cookie ou Basic Auth"""
from fastapi import HTTPException, Cookie, Depends, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from typing import Optional
import jwt
import os
import hmac

security = HTTPBasic(auto_error=False)
JWT_ALGORITHM = "HS256"


def _get_jwt_secret() -> Optional[str]:
    secret = os.environ.get("ADMIN_JWT_SECRET", "").strip()
    return secret if len(secret) >= 32 else None


async def require_admin(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None)
):
    """Dependency FastAPI — valida JWT cookie ou HTTP Basic Auth do admin"""
    # 1. Valida Cookie JWT se presente
    jwt_secret = _get_jwt_secret()
    if admin_token and jwt_secret:
        try:
            payload = jwt.decode(admin_token, jwt_secret, algorithms=[JWT_ALGORITHM])
            if payload.get("sub") == "admin":
                return payload
        except Exception:
            pass

    # 2. Valida HTTP Basic Auth se presente nos cabeçalhos
    admin_user = os.environ.get("ADMIN_USER", "").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()
    if credentials and admin_user and admin_pass:
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
