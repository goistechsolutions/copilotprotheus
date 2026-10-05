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


def _require_real_environment(environment_code: str) -> str:
    value = str(environment_code or "").strip()
    if not value or value.lower() in {"default", "none", "null"}:
        raise ValueError("environment_code Protheus é obrigatório e deve ser real.")
    return value


def _lock_key(tenant_code: str, environment_code: str) -> str:
    return f"{tenant_code}:{_require_real_environment(environment_code)}"


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
    return f"{_normalize_base_url(base_rest_url)}/api/framework/v1/genericQuery"


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
    environment_code: str,
) -> dict[str, Any]:
    import json
    from app.db.database import resolve_clean_tenant
    environment_code = _require_real_environment(environment_code)
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    try:
        row = db.execute(
            text(f"""
                SELECT
                    c.id,
                    e.environment_code,
                    c.base_rest_url,
                    c.auth_mode,
                    c.secret_ref,
                    c.active
                FROM "{clean_tenant}".protheus_connections c
                JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
                WHERE e.environment_code = :environment_code
                  AND c.active = TRUE
                LIMIT 1
            """),
            {
                "environment_code": environment_code,
            },
        ).mappings().first()
    except Exception as e:
        raise ValueError(f"Erro ao buscar conexo para {clean_tenant}/{environment_code}: {e}")

    if not row:
        raise ValueError(
            f"conexo REST Protheus ativa no localizada para {tenant_code}/{environment_code}"
        )
        
    sec_data = {}
    if row["secret_ref"]:
        try:
            sec_data = json.loads(row["secret_ref"])
        except:
            pass

    conn_dict = dict(row)
    conn_dict["tenant_code"] = tenant_code
    conn_dict["protheus_username"] = sec_data.get("protheus_username")
    conn_dict["encrypted_protheus_password"] = sec_data.get("encrypted_protheus_password")
    conn_dict["encrypted_access_token"] = sec_data.get("encrypted_access_token")
    conn_dict["encrypted_refresh_token"] = sec_data.get("encrypted_refresh_token")
    conn_dict["access_token_expires_at"] = sec_data.get("access_token_expires_at")
    conn_dict["token_updated_at"] = sec_data.get("token_updated_at")

    # The access_token_expires_at comes back as a string from JSON, we need datetime
    if conn_dict["access_token_expires_at"] and isinstance(conn_dict["access_token_expires_at"], str):
        from dateutil.parser import isoparse
        try:
            conn_dict["access_token_expires_at"] = isoparse(conn_dict["access_token_expires_at"])
        except:
            pass
            
    return _row_to_connection(conn_dict)


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


class ProtheusAuthError(RuntimeError):
    def __init__(
        self,
        message: str,
        status_code: int,
        response_body: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


async def _request_refresh_token(
    client: httpx.AsyncClient,
    base_rest_url: str,
    refresh_token: str,
) -> ProtheusToken:
    token_url = _token_url(base_rest_url)

    # 1. Modo form-urlencoded puro no body (Opção B)
    response = await client.post(
        token_url,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
    )

    # 2. Fallback com grant_type na query string
    if response.status_code >= 400:
        try:
            response_alt = await client.post(
                token_url,
                params={"grant_type": "refresh_token"},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "refresh_token": refresh_token,
                },
            )
            if response_alt.status_code < 400:
                response = response_alt
        except Exception:
            pass

    if response.status_code >= 400:
        logger.error("Falha refresh OAuth2 Protheus status=%s", response.status_code)
        raise ProtheusAuthError(
            message=f"refresh OAuth2 Protheus falhou: HTTP {response.status_code}",
            status_code=response.status_code,
            response_body=response.text[:500],
        )

    return _parse_token_response(response.json())


async def _request_password_token(
    client: httpx.AsyncClient,
    base_rest_url: str,
    username: str,
    password: str,
) -> ProtheusToken:
    token_url = _token_url(base_rest_url)

    # 1. Contrato oficial TOTVS: grant_type na query e credenciais somente
    # no endpoint /token, via headers. Essas credenciais nunca são usadas no
    # QueryRest.
    try:
        response = await client.post(
            token_url,
            params={"grant_type": "password"},
            headers={
                "Accept": "application/json",
                "username": username,
                "password": password,
            },
        )
    except httpx.RequestError as exc:
        logger.exception("Falha de rede ao obter token OAuth2 Protheus: %s", exc)
        raise ProtheusAuthError(
            message=f"Erro de comunicação com o Protheus na obtenção do token (Timeout ou conexão recusada).",
            status_code=502,
        ) from exc

    # 2. Compatibilidade com releases que exigem form-urlencoded no body
    if response.status_code >= 400:
        try:
            response_alt = await client.post(
                token_url,
                params={"grant_type": "password"},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "username": username,
                    "password": password,
                },
            )
            if response_alt.status_code < 400:
                response = response_alt
        except Exception:
            pass

    # 3. Compatibilidade adicional com AppServer configurado para JSON
    if response.status_code >= 400:
        try:
            response_json = await client.post(
                token_url,
                params={"grant_type": "password"},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json={
                    "username": username,
                    "password": password,
                },
            )
            if response_json.status_code < 400:
                response = response_json
        except Exception:
            pass

    # 4. Compatibilidade com AppServer que exige credenciais estritamente na URL (Query String)
    if response.status_code >= 400:
        try:
            response_query = await client.post(
                token_url,
                params={
                    "grant_type": "password",
                    "username": username,
                    "password": password
                },
                headers={
                    "Accept": "application/json",
                },
            )
            if response_query.status_code < 400:
                response = response_query
        except Exception:
            pass

    if response.status_code >= 400:
        logger.error("Falha OAuth2 Protheus status=%s", response.status_code)
        raise ProtheusAuthError(
            message=f"obtenção de token OAuth2 Protheus falhou: HTTP {response.status_code}",
            status_code=response.status_code,
            response_body=response.text[:500],
        )

    return _parse_token_response(response.json())


async def get_valid_access_token(
    db: Any,
    tenant_code: str,
    environment_code: str,
) -> str:
    connection = load_connection(db, tenant_code, environment_code)
    expires_at = connection.get("access_token_expires_at")

    if _is_token_valid(expires_at):
        logger.info("oauth2_token_cache_hit tenant=%s ambiente=%s", tenant_code, environment_code)
        return _decrypt_secret(connection["encrypted_access_token"])

    logger.info("oauth2_token_refresh_start tenant=%s ambiente=%s", tenant_code, environment_code)
    lock = _get_lock(tenant_code, environment_code)

    async with lock:
        # Recarrega depois do lock para evitar corrida entre workers.
        connection = load_connection(db, tenant_code, environment_code)
        expires_at = connection.get("access_token_expires_at")

        if _is_token_valid(expires_at):
            logger.info("oauth2_token_refreshed_by_peer tenant=%s ambiente=%s", tenant_code, environment_code)
            return _decrypt_secret(connection["encrypted_access_token"])

        base_url = connection["base_rest_url"]

        new_token: ProtheusToken | None = None

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS, 
            follow_redirects=False,
            verify=False,
        ) as client:
            encrypted_refresh = connection.get("encrypted_refresh_token")

            if encrypted_refresh:
                try:
                    logger.info("oauth2_refresh_grant_start tenant=%s ambiente=%s", tenant_code, environment_code)
                    refresh_token = _decrypt_secret(encrypted_refresh)

                    new_token = await _request_refresh_token(
                        client, base_url, refresh_token,
                    )
                except Exception:
                    logger.warning(
                        "oauth2_refresh_grant_failed tenant=%s ambiente=%s; tentando novo token",

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
                    
                logger.info("oauth2_password_grant_start tenant=%s ambiente=%s", tenant_code, environment_code)
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

        # Busca secret_ref atual
        from app.db.database import resolve_clean_tenant
        clean_tenant = resolve_clean_tenant(db, connection["tenant_code"])
        row = db.execute(
            text(f"SELECT secret_ref FROM \"{clean_tenant}\".protheus_connections WHERE id = :id"),
            {"id": connection["id"]}
        ).mappings().first()
        
        import json
        sec_data = {}
        if row and row["secret_ref"]:
            try:
                sec_data = json.loads(row["secret_ref"])
            except:
                pass
                
        sec_data["encrypted_access_token"] = encrypted_access
        sec_data["encrypted_refresh_token"] = encrypted_refresh_val
        sec_data["access_token_expires_at"] = new_token.expires_at.isoformat() if new_token.expires_at else None
        sec_data["token_updated_at"] = _utcnow().isoformat()
        
        db.execute(
            text(f"""
                UPDATE "{clean_tenant}".protheus_connections
                SET secret_ref = :secret_ref,
                    last_auth_error = NULL,
                    last_auth_status = NULL,
                    last_success_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": connection["id"],
                "secret_ref": json.dumps(sec_data)
            },
        )
        db.commit()
        logger.info("oauth2_token_persisted tenant=%s ambiente=%s", tenant_code, environment_code)

        return new_token.access_token


def invalidate_access_token(
    db: Any,
    tenant_code: str,
    environment_code: str,
) -> None:
    import json
    from app.db.database import resolve_clean_tenant
    environment_code = _require_real_environment(environment_code)
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    
    try:
        row = db.execute(
            text(f"""
                SELECT c.id, c.secret_ref 
                FROM "{clean_tenant}".protheus_connections c
                JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
                WHERE e.environment_code = :environment_code
            """),
            {"environment_code": environment_code}
        ).mappings().first()
        
        if not row:
            return
            
        sec_data = {}
        if row["secret_ref"]:
            try:
                sec_data = json.loads(row["secret_ref"])
            except:
                pass
                
        sec_data["encrypted_access_token"] = None
        sec_data["access_token_expires_at"] = None
        sec_data["token_updated_at"] = None
        
        db.execute(
            text(f"""
                UPDATE "{clean_tenant}".protheus_connections
                SET secret_ref = :secret_ref,
                    last_auth_error = 'access token invalidado após HTTP 401',
                    last_auth_status = 401,
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": row["id"],
                "secret_ref": json.dumps(sec_data)
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
