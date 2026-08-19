"""Rotas CRUD para Tenant — modelo V4 canônico.

Segurança:
- Protegido via Depends(require_admin).
- encrypted_protheus_password NUNCA é retornado em nenhum endpoint.
- Senha recebida como protheus_password (plaintext) → criptografada antes de persistir.
- Apenas platform_admin pode criar/deletar tenants.
"""
import re
from app.services.tenant_resolver import resolve_clean_tenant
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
import os

from app.db.database import get_db
from app.models.knowledge import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.core.admin_security import require_admin, require_admin_flexible
from typing import List, Optional

# prefix só com /tenants — main.py já adiciona /api
router = APIRouter(prefix="/tenants", tags=["Tenants"])

import base64
import hashlib

# ── Criptografia da senha REST Protheus ──────────────────────

def _get_fernet() -> Fernet:
    key = os.getenv("FERNET_KEY", "").strip().encode()
    if key:
        try:
            return Fernet(key)
        except Exception:
            pass
    # Derivação determinística de 32 bytes se FERNET_KEY não for configurada no .env
    secret = os.getenv("JWT_SECRET") or os.getenv("ADMIN_JWT_SECRET") or "copilot-protheus-fernet-fallback-key"
    key_32bytes = hashlib.sha256(secret.encode()).digest()
    fallback_key = base64.urlsafe_b64encode(key_32bytes)
    return Fernet(fallback_key)

def encrypt_password(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


# ── Helpers ──────────────────────────────────────────────────

def _apply_password(tenant_obj: Tenant, plaintext: Optional[str]) -> None:
    """Criptografa e persiste a senha somente se plaintext foi fornecido."""
    if plaintext:
        tenant_obj.encrypted_protheus_password = encrypt_password(plaintext)


# ── Endpoints Protegidos por Admin ─────────────────────────────

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
    conn = db.execute(text("SELECT base_rest_url, auth_mode, protheus_username FROM public.protheus_rest_connections WHERE tenant_code = :tc AND environment_code = 'default'"), {"tc": t.tenant_code}).mappings().first()
    rest_url = conn["base_rest_url"] if conn else ""
    user = conn["protheus_username"] if conn else ""
    auth_mode = conn["auth_mode"] if conn else "oauth2_password"
    
    return {
        "id": t.tenant_code,
        "name": t.tenant_name,
        "tenant_code": t.tenant_code,
        "tenant_name": t.tenant_name,
        "protheus_rest_url": rest_url,
        "protheus_webapp_url": t.webapp_url,
        "protheus_user": user,
        "auth_mode": auth_mode,
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
    import re, uuid
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

    # Cria schema isolado para o tenant
    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)


    if body.protheus_rest_url:
        await _sync_protheus_connection(
            db, clean_tenant, body.protheus_rest_url, 
            body.protheus_user, body.protheus_password, body.auth_mode
        )

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
        from app.db.database import ensure_tenant_tables
        ensure_tenant_tables(db, clean_tenant)


    if body.protheus_rest_url:
        await _sync_protheus_connection(
            db, clean_tenant, body.protheus_rest_url, 
            body.protheus_user, body.protheus_password, body.auth_mode
        )

    return _to_tenant_dict(db, tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    db.delete(tenant)
    db.commit()
