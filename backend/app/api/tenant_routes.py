"""Rotas CRUD para Tenant — modelo V4 canônico e isolamento de conexões Protheus.

Segurança:
- Protegido via Depends(require_admin).
- encrypted_protheus_password NUNCA é retornado em nenhum endpoint.
- Senha recebida como protheus_password (plaintext) → criptografada antes de persistir na tabela protheus_rest_connections.
- Senha do painel administrativo é estritamente isolada e rejeitada neste contexto.
"""
import base64
import hashlib
import os
import re
from datetime import datetime
from typing import List, Optional

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin_security import require_admin, require_admin_flexible
from app.db.database import get_db, ensure_tenant_tables
from app.models.knowledge import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.services.protheus_token_service import invalidate_access_token, get_valid_access_token
from app.services.tenant_resolver import resolve_clean_tenant

router = APIRouter(prefix="/tenants", tags=["Tenants"])


# ── Criptografia da senha REST Protheus ──────────────────────

def _get_fernet() -> Fernet:
    key = os.getenv("FERNET_KEY", "").strip().encode()
    if key:
        try:
            return Fernet(key)
        except Exception:
            pass
    secret = os.getenv("JWT_SECRET") or os.getenv("ADMIN_JWT_SECRET") or "copilot-protheus-fernet-fallback-key"
    key_32bytes = hashlib.sha256(secret.encode()).digest()
    fallback_key = base64.urlsafe_b64encode(key_32bytes)
    return Fernet(fallback_key)

def encrypt_password(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


# ── Helpers de Conexão e Validação ───────────────────────────

def validate_tenant_raw_dict(raw: dict) -> None:
    """Bloqueia a mistura indevida de senhas do painel administrativo no cadastro do tenant."""
    if "password" in raw and raw["password"]:
        raise HTTPException(
            status_code=400,
            detail="Senha do painel administrativo não pode ser enviada no cadastro do tenant."
        )
    conn = raw.get("connection")
    if isinstance(conn, dict) and "password" in conn and conn["password"]:
        raise HTTPException(
            status_code=400,
            detail="Use somente connection.protheus_password para a senha REST Protheus."
        )

def extract_connection_info(body: TenantCreate | TenantUpdate, db: Optional[Session] = None, tenant_code: Optional[str] = None) -> Optional[dict]:
    """Extrai e normaliza informações de conexão Protheus da requisição."""
    raw = body.model_dump(exclude_unset=False)
    validate_tenant_raw_dict(raw)

    conn = body.connection
    if conn:
        url = conn.base_rest_url or conn.protheus_rest_url or body.protheus_rest_url
        env = conn.environment_code or conn.protheus_ambiente or conn.ambiente or body.environment_code or body.protheus_ambiente or body.ambiente
        user = conn.protheus_username or conn.protheus_user or body.protheus_user
        pw = conn.protheus_password or body.protheus_password
        auth = conn.auth_mode or body.auth_mode or "oauth"
    else:
        url = body.protheus_rest_url
        env = body.environment_code or body.protheus_ambiente or body.ambiente
        user = body.protheus_user
        pw = body.protheus_password
        auth = body.auth_mode or "oauth"

    if not url or not str(url).strip():
        return None

    if (not env or not str(env).strip()) and db and tenant_code:
        # Busca o environment_code já cadastrado anteriormente se não veio no form
        existing_conn = db.execute(text("""
            SELECT environment_code FROM public.protheus_rest_connections
            WHERE tenant_code = :tc AND active = TRUE
            ORDER BY id DESC LIMIT 1
        """), {"tc": tenant_code}).mappings().first()
        if existing_conn and existing_conn.get("environment_code"):
            env = existing_conn["environment_code"]

    if not env or not str(env).strip():
        raise HTTPException(
            status_code=400,
            detail="Ambiente Protheus (environment_code) é obrigatório para configurar a conexão."
        )

    env_str = str(env).strip()
    if env_str.lower() == "none":
        raise HTTPException(status_code=400, detail="Ambiente Protheus inválido: None.")
    if env_str.lower() == "default":
        raise HTTPException(status_code=400, detail="Ambiente default não é permitido para este tenant.")
    if len(env_str) > 100:
        raise HTTPException(status_code=400, detail="Ambiente Protheus excede o tamanho permitido.")

    return {
        "env_code": env_str,
        "rest_url": str(url).strip().rstrip("/"),
        "username": str(user).strip() if user else "admin",
        "password": str(pw).strip() if pw else None,
        "auth_mode": str(auth).strip() if auth else "oauth"
    }

async def _sync_protheus_connection(db: Session, tenant_code: str, conn_info: dict):
    """Grava na tabela public.protheus_rest_connections e valida a autenticação."""
    env_code = conn_info["env_code"]
    rest_url = conn_info["rest_url"]
    username = conn_info["username"]
    password = conn_info["password"]
    auth_mode = conn_info["auth_mode"]

    enc_pw = encrypt_password(password) if password else None

    upsert_sql = text('''
        INSERT INTO public.protheus_rest_connections (
            tenant_code, environment_code, base_rest_url,
            auth_mode, protheus_username, encrypted_protheus_password, active
        ) VALUES (
            :t_code, :env_code, :url, :auth, :user, :pw, TRUE
        ) ON CONFLICT (tenant_code, environment_code) DO UPDATE SET
            base_rest_url = EXCLUDED.base_rest_url,
            auth_mode = EXCLUDED.auth_mode,
            protheus_username = EXCLUDED.protheus_username,
            encrypted_protheus_password = COALESCE(EXCLUDED.encrypted_protheus_password, public.protheus_rest_connections.encrypted_protheus_password),
            active = TRUE,
            updated_at = NOW();
    ''')

    db.execute(upsert_sql, {
        "t_code": tenant_code,
        "env_code": env_code,
        "url": rest_url,
        "auth": auth_mode,
        "user": username,
        "pw": enc_pw
    })
    db.commit()

    # Valida credenciais obtendo o token OAuth2
    try:
        invalidate_access_token(db, tenant_code, env_code)
        await get_valid_access_token(db, tenant_code, env_code)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao validar Conexão Protheus ({tenant_code}/{env_code}): {str(e)}"
        )


def find_tenant_by_id_or_code(db: Session, tenant_id: str | int) -> Optional[Tenant]:
    t_str = str(tenant_id or '').strip()
    if not t_str:
        return None
    t = db.query(Tenant).filter(Tenant.tenant_code == t_str).first()
    if not t:
        t = db.query(Tenant).filter(Tenant.schema_name == t_str).first()
    if not t and t_str.isdigit():
        t = db.query(Tenant).filter(Tenant.id == int(t_str)).first()
    return t


def _to_tenant_dict(db: Session, t: Tenant) -> dict:
    conn = db.execute(text("""
        SELECT 
            base_rest_url, 
            auth_mode, 
            protheus_username, 
            environment_code,
            encrypted_protheus_password,
            encrypted_access_token,
            access_token_expires_at,
            active
        FROM public.protheus_rest_connections 
        WHERE tenant_code = :tc AND active = TRUE 
        ORDER BY id DESC 
        LIMIT 1
    """), {"tc": t.tenant_code}).mappings().first()

    rest_url = conn["base_rest_url"] if conn else ""
    user = conn["protheus_username"] if conn else ""
    auth_mode = conn["auth_mode"] if conn else "oauth"
    env_code = conn["environment_code"] if conn else ""
    has_pw = bool(conn and conn["encrypted_protheus_password"] and conn["encrypted_protheus_password"].strip())
    has_tok = bool(conn and conn["encrypted_access_token"] and conn["encrypted_access_token"].strip())
    exp_at = conn["access_token_expires_at"].isoformat() if (conn and conn["access_token_expires_at"]) else None

    conn_obj = {
        "environment_code": env_code,
        "base_rest_url": rest_url,
        "auth_mode": auth_mode,
        "protheus_username": user,
        "has_password": has_pw,
        "has_access_token": has_tok,
        "access_token_expires_at": exp_at
    } if conn else None

    return {
        "id": t.tenant_code,
        "name": t.tenant_name,
        "tenant_code": t.tenant_code,
        "tenant_name": t.tenant_name,
        "protheus_rest_url": rest_url,
        "protheus_webapp_url": t.webapp_url,
        "protheus_user": user,
        "auth_mode": auth_mode,
        "environment_code": env_code,
        "connection": conn_obj,
        "system_prompt": t.system_prompt,
        "temperature": float(t.temperature) if t.temperature is not None else 0.2,
        "status": t.status or "active",
        "plan_code": t.plan_code,
        "cnpj": t.cnpj,
        "licenca_uso": t.licenca_uso,
        "created_at": t.created_at,
        "updated_at": t.updated_at
    }


# ── Endpoints Protegidos por Admin ─────────────────────────────

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict], include_in_schema=False)
def list_tenants(db: Session = Depends(get_db), _admin=Depends(require_admin_flexible)):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    return [_to_tenant_dict(db, t) for t in tenants]


@router.get("/{tenant_id}", response_model=dict)
def get_tenant(tenant_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin_flexible)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return _to_tenant_dict(db, tenant)


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    import uuid
    raw_code = body.tenant_code or body.tenant_name or body.name or body.id or "tenant"
    t_code = resolve_clean_tenant(str(raw_code).lower().strip())
    if not t_code:
        t_code = f"tenant_{uuid.uuid4().hex[:6]}"

    clean_tenant = t_code
    tenant = find_tenant_by_id_or_code(db, clean_tenant)

    if not tenant:
        tenant = Tenant(
            tenant_code=clean_tenant,
            tenant_name=body.tenant_name or body.name or clean_tenant,
            schema_name=clean_tenant,
            status=body.status or 'active',
            plan_code=body.plan_code,
            cnpj=body.cnpj,
            licenca_uso=body.licenca_uso,
            webapp_url=body.protheus_webapp_url,
            system_prompt=body.system_prompt,
            temperature=body.temperature,
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    else:
        tenant.tenant_name = body.tenant_name or body.name or tenant.tenant_name
        tenant.status = body.status or tenant.status
        tenant.plan_code = body.plan_code or tenant.plan_code
        tenant.cnpj = body.cnpj or tenant.cnpj
        tenant.licenca_uso = body.licenca_uso or tenant.licenca_uso
        tenant.webapp_url = body.protheus_webapp_url or tenant.webapp_url
        tenant.system_prompt = body.system_prompt or tenant.system_prompt
        tenant.temperature = body.temperature if body.temperature is not None else tenant.temperature
        db.commit()
        db.refresh(tenant)

    # Garante o schema isolado
    ensure_tenant_tables(db, clean_tenant)

    # Processa e valida conexão REST Protheus
    conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
    if conn_info:
        await _sync_protheus_connection(db, clean_tenant, conn_info)

    return _to_tenant_dict(db, tenant)


@router.put("/{tenant_id}", response_model=dict)
async def update_tenant(tenant_id: str, body: TenantUpdate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    if body.tenant_name or body.name:
        tenant.tenant_name = body.tenant_name or body.name
    if body.status:
        tenant.status = body.status
    if body.plan_code:
        tenant.plan_code = body.plan_code
    if body.cnpj is not None:
        tenant.cnpj = body.cnpj
    if body.licenca_uso is not None:
        tenant.licenca_uso = body.licenca_uso
    if body.protheus_webapp_url is not None:
        tenant.webapp_url = body.protheus_webapp_url
    if body.system_prompt is not None:
        tenant.system_prompt = body.system_prompt
    if body.temperature is not None:
        tenant.temperature = body.temperature

    db.commit()
    db.refresh(tenant)

    clean_tenant = resolve_clean_tenant(tenant.tenant_code)
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)

    # Processa e valida conexão REST Protheus
    conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
    if conn_info:
        await _sync_protheus_connection(db, clean_tenant, conn_info)

    return _to_tenant_dict(db, tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    db.delete(tenant)
    db.commit()
