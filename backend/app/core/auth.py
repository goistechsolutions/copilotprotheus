import os
import jwt
from fastapi import HTTPException, Security, Cookie, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

security = HTTPBearer(auto_error=False)

JWT_SECRET = os.getenv("JWT_SECRET", "copilot-protheus-dev-secret-change-me")
JWT_ALGORITHM = "HS256"


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Valida JWT exclusivamente via Bearer header (Authorization: Bearer <token>).
    Usado nas rotas de API REST padrão.
    """
    if not credentials:
        return {}
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalido: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_flexible(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(security),
    access_token: Optional[str] = Cookie(default=None),
) -> dict:
    """Valida JWT via Bearer header (prioridade) ou cookie 'access_token' (fallback).
    Usado em rotas acessadas por iframes ou contextos onde o header Authorization
    não pode ser injetado pelo browser (ex: proxy /adminer).
    """
    token: Optional[str] = None

    # Prioridade 1: Bearer header
    if credentials and credentials.credentials:
        token = credentials.credentials
    # Prioridade 2: Cookie HttpOnly
    elif access_token:
        token = access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária. Faça login no painel administrativo.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
