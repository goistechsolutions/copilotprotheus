"""Dependência única para proteger rotas administrativas via JWT HttpOnly ou Basic Auth."""
from typing import Any, Dict, Optional
import hmac
import os

import jwt
from fastapi import Cookie, Depends, HTTPException, Query, status
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


def _csv_env(name: str) -> list[str]:
    return [item.strip().lower() for item in os.environ.get(name, "").split(",") if item.strip()]


def _admin_access_claims() -> Dict[str, Any]:
    """Lê o escopo administrativo de configuração, sem embutir tenants no código."""
    scope_level = os.environ.get("ADMIN_SCOPE_LEVEL", "platform").strip().lower() or "platform"
    if scope_level not in {"platform", "tenant"}:
        raise RuntimeError("ADMIN_SCOPE_LEVEL deve ser 'platform' ou 'tenant'.")
    tenant_ids = _csv_env("ADMIN_TENANT_IDS")
    permissions = _csv_env("ADMIN_PERMISSIONS") or ["*"]
    if scope_level == "tenant" and not tenant_ids:
        raise RuntimeError("ADMIN_TENANT_IDS é obrigatório para ADMIN_SCOPE_LEVEL=tenant.")
    return {"scope_level": scope_level, "tenant_ids": tenant_ids, "permissions": permissions}


def _clean_tenant_id(tenant_id: str) -> str:
    value = str(tenant_id or "").strip().lower()
    if not value or value in {"public", "default", "none", "null"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id válido é obrigatório.")
    return value


def authorize_admin_access(admin: Dict[str, Any], permission: str, tenant_id: Optional[str] = None) -> str | None:
    """Aplica permissão e escopo do token; tokens legados são platform por compatibilidade."""
    claims = admin or {}
    permissions = {str(item).strip().lower() for item in (claims.get("permissions") or []) if str(item).strip()}
    if permissions and "*" not in permissions and permission.lower() not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão administrativa insuficiente.")

    if tenant_id is None:
        return None

    requested = _clean_tenant_id(tenant_id)
    scope_level = str(claims.get("scope_level") or ("platform" if claims.get("sub") == "admin" else "tenant")).lower()
    if scope_level == "platform":
        return requested

    allowed_tenants = {str(item).strip().lower() for item in (claims.get("tenant_ids") or []) if str(item).strip()}
    claim_tenant = str(claims.get("tenant_id") or "").strip().lower()
    if requested not in allowed_tenants and requested != claim_tenant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do escopo administrativo.")
    return requested


def require_admin_permission(permission: str):
    async def dependency(admin: dict = Depends(require_admin)):
        authorize_admin_access(admin, permission)
        return admin

    return dependency


def require_admin_tenant_access(permission: str):
    async def dependency(
        tenant_id: str = Query(...),
        admin: dict = Depends(require_admin),
    ):
        authorize_admin_access(admin, permission, tenant_id)
        return admin

    return dependency


async def require_admin(
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(default=None),
):
    """Valida somente uma sessão JWT emitida pelo login ou Basic Auth configurado."""
    if admin_token:
        try:
            payload = _decode_admin_token(admin_token)
            if payload.get("sub") == "admin":
                if not payload.get("scope_level") or "permissions" not in payload or "tenant_ids" not in payload:
                    payload = {**_admin_access_claims(), **payload}
                return payload
        except (jwt.InvalidTokenError, ValueError):
            pass

    admin_user = os.environ.get("ADMIN_USER", "").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()
    if credentials and admin_user and admin_pass:
        user_ok = hmac.compare_digest(credentials.username.strip().lower(), admin_user.lower())
        pass_ok = hmac.compare_digest(credentials.password.strip(), admin_pass)
        if user_ok and pass_ok:
            return {"sub": credentials.username.strip(), **_admin_access_claims()}

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
