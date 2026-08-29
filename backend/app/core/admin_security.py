"""Dependência única para proteger rotas administrativas via JWT HttpOnly ou Basic Auth."""
from typing import Optional
import hmac
import os

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic(auto_error=False)
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "copilot-protheus-admin"


def _get_jwt_secret() -> Optional[str]:
    secret = os.environ.get("ADMIN_JWT_SECRET", "").strip()
    return secret if len(secret) >= 32 else None


def _decode_admin_token(token: str) -> dict:
    secret = _get_jwt_secret()
    if not secret:
        raise ValueError("ADMIN_JWT_SECRET não configurado com o tamanho mínimo")
    return jwt.decode(
        token,
        secret,
        algorithms=[JWT_ALGORITHM],
        issuer=JWT_ISSUER,
        options={"require": ["exp", "iat", "iss", "sub"]},
    )


async def require_admin(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None),
):
    """Valida somente uma sessão JWT emitida pelo login ou Basic Auth configurado."""
    if admin_token:
        try:
            payload = _decode_admin_token(admin_token)
            if payload.get("sub") == "admin":
                return payload
        except (jwt.InvalidTokenError, ValueError):
            pass

    admin_user = os.environ.get("ADMIN_USER", "").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()
    if credentials and admin_user and admin_pass:
        user_ok = hmac.compare_digest(credentials.username.strip().lower(), admin_user.lower())
        pass_ok = hmac.compare_digest(credentials.password.strip(), admin_pass)
        if user_ok and pass_ok:
            return {"sub": credentials.username.strip()}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão não autenticada ou token ausente. Faça login novamente.",
        headers={"WWW-Authenticate": "Basic"},
    )


# Compatibilidade explícita para imports legados: nunca converte falha de autenticação em acesso.
async def require_admin_flexible(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None),
):
    return await require_admin(credentials, admin_token)
