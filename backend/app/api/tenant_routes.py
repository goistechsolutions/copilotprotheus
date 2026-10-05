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

from app.core.admin_security import require_admin
from app.db.database import get_db, ensure_tenant_tables
from app.models.knowledge import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.services.protheus_token_service import invalidate_access_token
from app.schemas.protheus_context import ProtheusContext
from app.services.protheus_integration_service import IntegrationFailure, ProtheusIntegrationService
from app.services.tenant_resolver import resolve_clean_tenant
from app.services.license_service import sync_license_entitlement

router = APIRouter(prefix="/tenants", tags=["Tenants"])


from app.core.security import encrypt_password, decrypt_password


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
        url = conn.base_rest_url
        env = conn.environment_code
        user = conn.protheus_username
        pw = conn.protheus_password
        auth = conn.auth_mode
    else:
        return None

    if not url or not str(url).strip():
        return None

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
        "username": str(user).strip(),
        "password": str(pw).strip() if pw else None,
        "auth_mode": str(auth).strip()
    }

def _sync_tenant_license_contract(db: Session, tenant, tenant_schema: str, licenca_uso: str = None) -> None:
    """Sincroniza somente a licença JWT explicitamente salva no cadastro."""
    if not licenca_uso:
        return
    try:
        sync_license_entitlement(
            db,
            tenant_code=tenant.tenant_code,
            tenant_schema=tenant_schema,
            plan_code=None,
            license_token=tenant.licenca_uso,
            cnpj=None,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Licença não ativada: {exc}") from exc


async def _sync_protheus_connection(db: Session, tenant_code: str, conn_info: dict):
    """Grava a conexo cifrada e valida OAuth2 pela fachada nica de integrao."""
    import json
    from app.db.database import resolve_clean_tenant
    
    clean_tenant = resolve_clean_tenant(tenant_code)
    env_code = conn_info["env_code"]
    rest_url = conn_info["rest_url"]
    username = conn_info["username"]
    password = conn_info["password"]
    auth_mode = conn_info["auth_mode"]
    ProtheusIntegrationService._validate_base_url(rest_url)

    # 1. Garante que o ambiente existe
    env_id = db.execute(
        text(f"""
            INSERT INTO "{clean_tenant}".environments (environment_code, environment_name, status)
            VALUES (:env_code, :env_code, 'ACTIVE')
            ON CONFLICT (environment_code) DO UPDATE SET status = 'ACTIVE'
            RETURNING id
        """),
        {"env_code": env_code}
    ).scalar()

    # 2. Busca a senha existente caso no tenha sido enviada
    existing_secret = db.execute(
        text(f"""
            SELECT secret_ref
            FROM "{clean_tenant}".protheus_connections
            WHERE environment_id = :env_id
            LIMIT 1
        """),
        {"env_id": env_id}
    ).scalar()

    existing_password = None
    if existing_secret:
        try:
            sec_data = json.loads(existing_secret)
            existing_password = sec_data.get("encrypted_protheus_password")
        except:
            pass

    if not password and not existing_password:
        raise HTTPException(
            status_code=400,
            detail="Senha REST Protheus  obrigatria para uma nova conexo.",
        )

    enc_pw = encrypt_password(password) if password else existing_password

    new_secret = {
        "protheus_username": username,
        "encrypted_protheus_password": enc_pw,
    }
    if existing_secret:
        try:
            sec_data = json.loads(existing_secret)
            # Preserve tokens se existirem
            new_secret["encrypted_access_token"] = sec_data.get("encrypted_access_token")
            new_secret["encrypted_refresh_token"] = sec_data.get("encrypted_refresh_token")
            new_secret["access_token_expires_at"] = sec_data.get("access_token_expires_at")
            new_secret["token_updated_at"] = sec_data.get("token_updated_at")
        except:
            pass

    upsert_sql = text(f"""
        INSERT INTO "{clean_tenant}".protheus_connections (
            environment_id, base_rest_url, auth_mode, secret_ref, active
        ) VALUES (
            :env_id, :url, :auth, :sec_ref, TRUE
        ) ON CONFLICT (environment_id) DO UPDATE SET
            base_rest_url = EXCLUDED.base_rest_url,
            auth_mode = EXCLUDED.auth_mode,
            secret_ref = EXCLUDED.secret_ref,
            active = TRUE,
            updated_at = NOW();
    """)

    db.execute(upsert_sql, {
        "env_id": env_id,
        "url": rest_url,
        "auth": auth_mode,
        "sec_ref": json.dumps(new_secret)
    })
    db.commit()

    try:
        invalidate_access_token(db, clean_tenant, env_code)
        context = ProtheusContext(tenant_code=clean_tenant, environment_code=env_code)
        await ProtheusIntegrationService(db, context).authenticate()
    except IntegrationFailure as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Falha na autenticao com o ERP ({env_code}): {exc.message}"
        ) from exc


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
    from app.db.database import resolve_clean_tenant
    import json
    import datetime
    clean_tenant = resolve_clean_tenant(t.tenant_code)
    try:
        conn = db.execute(text(f"""
            SELECT 
                c.base_rest_url, 
                c.auth_mode, 
                c.secret_ref,
                e.environment_code
            FROM "{clean_tenant}".protheus_connections c
            JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
            WHERE c.active = TRUE
            ORDER BY c.updated_at DESC 
            LIMIT 1
        """)).mappings().first()
    except Exception:
        conn = None

    sec_data = {}
    if conn and conn["secret_ref"]:
        try:
            sec_data = json.loads(conn["secret_ref"])
        except:
            pass

    rest_url = conn["base_rest_url"] if conn else ""
    auth_mode = conn["auth_mode"] if conn else "oauth"
    env_code = conn["environment_code"] if conn else ""
    user = sec_data.get("protheus_username", "")
    has_pw = bool(sec_data.get("encrypted_protheus_password"))
    has_tok = bool(sec_data.get("encrypted_access_token"))
    exp_at = sec_data.get("access_token_expires_at")
    
    conn_obj = {
        "environment_code": env_code,
        "base_rest_url": rest_url,
        "auth_mode": auth_mode,
        "protheus_username": user,
        "has_password": has_pw,
        "has_access_token": has_tok,
        "access_token_expires_at": exp_at,
    }

    return {
        "id": str(t.id),
        "tenant_code": t.tenant_code,
        "name": t.tenant_name,
        "schema_name": t.schema_name,
        "status": t.status,
        "plan_code": t.plan_code,
        "cnpj": t.cnpj,
        "licenca_uso": t.licenca_uso,
        "protheus_webapp_url": t.webapp_url,
        "system_prompt": t.system_prompt,
        "temperature": t.temperature,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "connection": conn_obj if env_code else None
    }


# ── Endpoints Protegidos por Admin ─────────────────────────────

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict], include_in_schema=False)
def list_tenants(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    return [_to_tenant_dict(db, t) for t in tenants]


@router.get("/{tenant_id}", response_model=dict)
def get_tenant(tenant_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return _to_tenant_dict(db, tenant)


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    import uuid
    raw_code = body.tenant_code or body.name or body.id or "tenant"
    t_code = resolve_clean_tenant(str(raw_code).lower().strip())
    if not t_code:
        t_code = f"tenant_{uuid.uuid4().hex[:6]}"

    clean_tenant = t_code
    tenant = find_tenant_by_id_or_code(db, clean_tenant)

    if not tenant:
        tenant = Tenant(
            tenant_code=clean_tenant,
            tenant_name=body.name or clean_tenant,
            schema_name=clean_tenant,
            status=(body.status or 'ACTIVE').upper()
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    else:
        tenant.tenant_name = body.name or tenant.tenant_name
        tenant.status = str(body.status or tenant.status).upper()
        db.commit()
        db.refresh(tenant)

    # Garante o schema isolado
    db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})
    db.commit()

    # Materializa a licença assinada no contrato exigido pelo EntitlementGuard.
    if body.licenca_uso is not None:
        _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

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

    if body.name:
        tenant.tenant_name = body.name
    if body.status:
        tenant.status = str(body.status).upper()
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
        db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})
    db.commit()

    # Materializa a licença assinada no contrato exigido pelo EntitlementGuard.
    if body.licenca_uso is not None:
        _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

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
