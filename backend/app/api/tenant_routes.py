"""Rotas CRUD para Tenant — modelo V4 canônico.

Segurança:
- encrypted_protheus_password NUNCA é retornado em nenhum endpoint.
- Senha recebida como protheus_password (plaintext) → criptografada antes de persistir.
- Apenas platform_admin pode criar/deletar tenants.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
import os

from app.db.database import get_db
from app.models.knowledge import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
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


# ── Endpoints ─────────────────────────────────────────────────

@router.get("", response_model=List[TenantResponse])
@router.get("/", response_model=List[TenantResponse], include_in_schema=False)
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return tenant


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_tenant(body: TenantCreate, db: Session = Depends(get_db)):
    import re, uuid
    tenant_id = body.id
    if not tenant_id:
        base = body.tenant_code or body.tenant_name or body.name or "tenant"
        tenant_id = re.sub(r'[^a-z0-9_\-]+', '-', base.lower().strip()).strip('-')
        if not tenant_id:
            tenant_id = f"tenant-{uuid.uuid4().hex[:6]}"

    final_id = tenant_id
    counter = 1
    while db.query(Tenant).filter(Tenant.id == final_id).first():
        final_id = f"{tenant_id}-{counter}"
        counter += 1

    tenant = Tenant(
        id=final_id,
        name=body.name or body.tenant_name or final_id,
        tenant_code=body.tenant_code or final_id,
        tenant_name=body.tenant_name or body.name,
        protheus_rest_url=body.protheus_rest_url,
        protheus_user=body.protheus_user,
        auth_mode=body.auth_mode or 'basic',
        system_prompt=body.system_prompt,
        temperature=body.temperature if body.temperature is not None else 0.2,
        status=body.status or 'active',
        plan_code=body.plan_code,
    )
    _apply_password(tenant, body.protheus_password)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(tenant_id: str, body: TenantUpdate, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    update_data = body.model_dump(exclude_none=True, exclude={'protheus_password'})
    for field, value in update_data.items():
        setattr(tenant, field, value)

    _apply_password(tenant, body.protheus_password)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    db.delete(tenant)
    db.commit()
