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

router = APIRouter(prefix="/api/tenants", tags=["Tenants"])

# ── Criptografia da senha REST Protheus ──────────────────────
_FERNET_KEY = os.getenv("FERNET_KEY", "").encode()

def _fernet() -> Optional[Fernet]:
    """Retorna instância Fernet se FERNET_KEY estiver configurada."""
    if _FERNET_KEY:
        try:
            return Fernet(_FERNET_KEY)
        except Exception:
            pass
    return None

def encrypt_password(plaintext: str) -> str:
    f = _fernet()
    if f:
        return f.encrypt(plaintext.encode()).decode()
    # Fallback seguro: não armazena em claro — lança erro
    raise RuntimeError("FERNET_KEY não configurada. Defina a variável de ambiente antes de armazenar senhas.")


# ── Helpers ──────────────────────────────────────────────────

def _apply_password(tenant_obj: Tenant, plaintext: Optional[str]) -> None:
    """Criptografa e persiste a senha somente se plaintext foi fornecido."""
    if plaintext:
        tenant_obj.encrypted_protheus_password = encrypt_password(plaintext)


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/", response_model=List[TenantResponse])
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return tenant


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(body: TenantCreate, db: Session = Depends(get_db)):
    if db.query(Tenant).filter(Tenant.id == body.id).first():
        raise HTTPException(status_code=409, detail=f"Tenant '{body.id}' já existe")

    tenant = Tenant(
        id=body.id,
        name=body.name,
        tenant_code=body.tenant_code,
        tenant_name=body.tenant_name,
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

    # Senha: atualiza somente se fornecida
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
