from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.core.config import settings
from typing import List, Optional

router = APIRouter(tags=["tenants"])

# Validação do Admin Key
def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado. Admin key inválida ou ausente."
        )
    return x_admin_key

@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).order_by(Tenant.id.asc()).all()

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return tenant

@router.post("/tenants", response_model=TenantResponse)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    existing = db.query(Tenant).filter(Tenant.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um Cliente cadastrado com este ID.")
    
    tenant_data = payload.model_dump()
    # Mapeando protheus_password para encrypted_protheus_password
    pw = tenant_data.pop("protheus_password", "")
    tenant_data["encrypted_protheus_password"] = pw
    
    tenant = Tenant(**tenant_data)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
def update_tenant(tenant_id: str, payload: TenantUpdate, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    
    update_data = payload.model_dump(exclude_unset=True)
    if "protheus_password" in update_data:
        pw = update_data.pop("protheus_password")
        if pw: # Só atualiza se foi fornecida uma senha nova não vazia
            tenant.encrypted_protheus_password = pw
            
    for k, v in update_data.items():
        setattr(tenant, k, v)
        
    db.commit()
    db.refresh(tenant)
    return tenant

@router.delete("/tenants/{tenant_id}")
def delete_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    db.delete(tenant)
    db.commit()
    return {"message": "Cliente excluído com sucesso."}
