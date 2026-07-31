"""Rotas CRUD para Tenant — modelo V4 canônico.

Segurança:
- Protegido via Depends(require_admin).
- encrypted_protheus_password NUNCA é retornado em nenhum endpoint.
- Senha recebida como protheus_password (plaintext) → criptografada antes de persistir.
- Apenas platform_admin pode criar/deletar tenants.
"""
import re
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
    import re
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', t.tenant_code)
    rest_url, user, prompt, temp = None, None, None, 0.2
    if clean_tenant and clean_tenant != "public":
        try:
            res = db.execute(text(f'SELECT protheus_rest_url, protheus_usuario, system_prompt, temperature FROM "{clean_tenant}".company_info LIMIT 1')).first()
            if res:
                rest_url = res[0]
                user = res[1]
                prompt = res[2]
                temp = float(res[3]) if res[3] is not None else 0.2
        except Exception:
            pass

    return {
        "id": t.tenant_code,
        "name": t.tenant_name,
        "tenant_code": t.tenant_code,
        "tenant_name": t.tenant_name,
        "protheus_rest_url": rest_url,
        "protheus_user": user,
        "auth_mode": "basic",
        "system_prompt": prompt,
        "temperature": temp,
        "status": t.status or "active",
        "plan_code": t.plan_code,
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
def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    import re, uuid
    raw_code = body.tenant_code or body.id or body.tenant_name or body.name or "tenant"
    t_code = re.sub(r'[^a-z0-9_]+', '_', str(raw_code).lower().strip()).strip('_')
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
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    else:
        tenant.tenant_name = body.tenant_name or body.name or tenant.tenant_name
        tenant.status = body.status or tenant.status
        tenant.plan_code = body.plan_code or tenant.plan_code
        db.commit()
        db.refresh(tenant)

    # Cria schema isolado para o tenant
    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)

    return _to_tenant_dict(db, tenant)


@router.put("/{tenant_id}", response_model=dict)
def update_tenant(tenant_id: str, body: TenantUpdate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    if body.tenant_name or body.name:
        tenant.tenant_name = body.tenant_name or body.name
    if body.status:
        tenant.status = body.status
    if body.plan_code:
        tenant.plan_code = body.plan_code

    db.commit()
    db.refresh(tenant)

    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant.tenant_code)
    if clean_tenant and clean_tenant != "public":
        from app.db.database import ensure_tenant_tables
        ensure_tenant_tables(db, clean_tenant)

    return _to_tenant_dict(db, tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    db.delete(tenant)
    db.commit()
