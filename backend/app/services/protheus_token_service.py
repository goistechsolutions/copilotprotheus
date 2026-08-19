from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import httpx
from sqlalchemy import text

from app.core.security import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)

TOKEN_SAFETY_MARGIN_SECONDS = 300
REQUEST_TIMEOUT_SECONDS = 60

_token_locks: dict[str, asyncio.Lock] = {}


@dataclass(frozen=True)
class ProtheusToken:
    access_token: str
    expires_at: datetime
    refresh_token: str | None = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _lock_key(tenant_code: str, environment_code: str) -> str:
    return f"{tenant_code}:{environment_code}"


def _get_lock(tenant_code: str, environment_code: str) -> asyncio.Lock:
    key = _lock_key(tenant_code, environment_code)
    if key not in _token_locks:
        _token_locks[key] = asyncio.Lock()
    return _token_locks[key]


def _normalize_base_url(base_rest_url: str) -> str:
    return str(base_rest_url or "").strip().rstrip("/")


def _token_url(base_rest_url: str) -> str:
    return f"{_normalize_base_url(base_rest_url)}/api/oauth2/v1/token"


def _queryrest_url(base_rest_url: str) -> str:
    return f"{_normalize_base_url(base_rest_url)}/QueryRest"


def _is_token_valid(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    threshold = _utcnow() + timedelta(seconds=TOKEN_SAFETY_MARGIN_SECONDS)
    return expires_at > threshold


def _decrypt_secret(value: str | None) -> str:
    if not value:
        raise ValueError("segredo Protheus não configurado")
    return decrypt_password(value)


def _encrypt_secret(value: str) -> str:
    if not value:
        raise ValueError("segredo vazio não pode ser cifrado")
    return encrypt_password(value)


def _row_to_connection(row: Mapping[str, Any]) -> dict[str, Any]:
    return dict(row)


def load_connection(
    db: Any,
    tenant_code: str,
    environment_code: str = "default",
) -> dict[str, Any]:
    row = db.execute(
        text("""
            SELECT
                id,
                tenant_code,
                environment_code,
                base_rest_url,
                auth_mode,
                protheus_username,
                encrypted_protheus_password,
                encrypted_access_token,
                encrypted_refresh_token,
                access_token_expires_at,
                token_updated_at,
                active
            FROM public.protheus_rest_connections
            WHERE tenant_code = :tenant_code
              AND environment_code = :environment_code
              AND active = TRUE
            LIMIT 1
        """),
        {
            "tenant_code": tenant_code,
            "environment_code": environment_code,
        },
    ).mappings().first()

    if not row:
        raise ValueError(
            f"conexão REST Protheus ativa não localizada para {tenant_code}/{environment_code}"
        )

    return _row_to_connection(row)


def _build_expires_at(expires_in: int | str | None) -> datetime:
    try:
        seconds = int(expires_in or 3600)
    except (TypeError, ValueError):
        seconds = 3600
    return _utcnow() + timedelta(seconds=seconds)


def _parse_token_response(data: Mapping[str, Any]) -> ProtheusToken:
    access_token = data.get("access_token")
    if not access_token:
        raise ValueError("resposta OAuth2 não contém access_token")

    return ProtheusToken(
        access_token=str(access_token),
        expires_at=_build_expires_at(data.get("expires_in")),
        refresh_token=(
            str(data["refresh_token"]) if data.get("refresh_token") else None
        ),
    )


async def _request_refresh_token(
    client: httpx.AsyncClient,
    base_rest_url: str,
    refresh_token: str,
) -> ProtheusToken:
    response = await client.post(
        _token_url(base_rest_url),
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={
            "Accept": "application/json",
        },
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"refresh OAuth2 Protheus falhou: HTTP {response.status_code} - {response.text}"
        )

    return _parse_token_response(response.json())


async def _request_password_token(
    client: httpx.AsyncClient,
    base_rest_url: str,
    username: str,
    password: str,
) -> ProtheusToken:
    credentials = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")

    response = await client.post(
        _token_url(base_rest_url),
        data={
            "grant_type": "password",
            "username": username,
            "password": password,
        },
        headers={
            "Accept": "application/json",
            "Authorization": f"Basic {credentials}",
        },
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"obtenção de token OAuth2 Protheus falhou: HTTP {response.status_code} - {response.text}"
        )

    return _parse_token_response(response.json())


async def get_valid_access_token(
    db: Any,
    tenant_code: str,
    environment_code: str = "default",
) -> str:
    connection = load_connection(db, tenant_code, environment_code)
    expires_at = connection.get("access_token_expires_at")

    if _is_token_valid(expires_at):
        return _decrypt_secret(connection["encrypted_access_token"])

    lock = _get_lock(tenant_code, environment_code)

    async with lock:
        # Recarrega depois do lock para evitar corrida entre workers.
        connection = load_connection(db, tenant_code, environment_code)
        expires_at = connection.get("access_token_expires_at")

        if _is_token_valid(expires_at):
            return _decrypt_secret(connection["encrypted_access_token"])

        base_url = connection["base_rest_url"]
        new_token: ProtheusToken | None = None

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=False,
        ) as client:
            encrypted_refresh = connection.get("encrypted_refresh_token")

            if encrypted_refresh:
                try:
                    refresh_token = _decrypt_secret(encrypted_refresh)
                    new_token = await _request_refresh_token(
                        client, base_url, refresh_token,
                    )
                except Exception:
                    logger.warning(
                        "refresh OAuth2 falhou para tenant=%s ambiente=%s; tentando novo token",
                        tenant_code, environment_code,
                    )

            if new_token is None:
                username = connection.get("protheus_username")
                password_encrypted = connection.get("encrypted_protheus_password")
                
                if not username or not password_encrypted:
                    raise ValueError(
                        f"Credenciais OAuth2 do Protheus (usuário ou senha) não estão configuradas no banco de dados "
                        f"para o tenant '{tenant_code}' (ambiente '{environment_code}')."
                    )
                    
                password = _decrypt_secret(password_encrypted)

                new_token = await _request_password_token(
                    client,
                    base_url,
                    username,
                    password,
                )

        encrypted_access = _encrypt_secret(new_token.access_token)
        encrypted_refresh_val = (
            _encrypt_secret(new_token.refresh_token)
            if new_token.refresh_token
            else connection.get("encrypted_refresh_token")
        )

        db.execute(
            text("""
                UPDATE public.protheus_rest_connections
                SET encrypted_access_token = :access_token,
                    encrypted_refresh_token = :refresh_token,
                    access_token_expires_at = :expires_at,
                    token_updated_at = NOW(),
                    last_auth_error = NULL,
                    last_auth_status = NULL,
                    last_success_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": connection["id"],
                "access_token": encrypted_access,
                "refresh_token": encrypted_refresh_val,
                "expires_at": new_token.expires_at,
            },
        )
        db.commit()

        return new_token.access_token


def invalidate_access_token(
    db: Any,
    tenant_code: str,
    environment_code: str = "default",
) -> None:
    db.execute(
        text("""
            UPDATE public.protheus_rest_connections
            SET encrypted_access_token = NULL,
                access_token_expires_at = NULL,
                token_updated_at = NULL,
                last_auth_error = 'access token invalidado após HTTP 401',
                last_auth_status = 401,
                updated_at = NOW()
            WHERE tenant_code = :tenant_code
              AND environment_code = :environment_code
        """),
        {
            "tenant_code": tenant_code,
            "environment_code": environment_code,
        },
    )
    db.commit()
