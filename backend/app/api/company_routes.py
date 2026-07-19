from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import Company
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse, LicenseGenerateRequest, LicenseVerifyRequest, SessionValidateRequest
from app.services.license_service import generate_license, verify_license
from app.core.config import settings
from typing import List, Optional
from datetime import datetime
import jwt

router = APIRouter(tags=["companies"])

# Validação do Admin Key
def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado. Admin key inválida ou ausente."
        )
    return x_admin_key

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).order_by(Company.id.asc()).all()

@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return comp

@router.post("/companies", response_model=CompanyResponse)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    # Evitar duplicar CNPJ
    existing = db.query(Company).filter(Company.cnpj == payload.cnpj).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma empresa cadastrada com este CNPJ.")
    
    if payload.tenant_id == "":
        payload.tenant_id = None
        
    comp = Company(**payload.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    
    if payload.tenant_id == "":
        payload.tenant_id = None
        
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(comp, k, v)
        
    db.commit()
    db.refresh(comp)
    return comp

@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    db.delete(comp)
    db.commit()
    return {"message": "Empresa excluída com sucesso."}

@router.post("/license/generate")
def api_generate_license(payload: LicenseGenerateRequest, admin_key: str = Depends(verify_admin_key)):
    try:
        token = generate_license(
            cnpj=payload.cnpj,
            expiration_date=payload.expiration_date,
            plan_level=payload.plan_level
        )
        return {"token": token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao gerar licença: {str(e)}")

@router.post("/license/verify")
def api_verify_license(payload: LicenseVerifyRequest):
    try:
        info = verify_license(payload.token, expected_cnpj=payload.cnpj)
        # Formatar expiração legível
        exp_dt = datetime.fromtimestamp(info["exp"])
        info["expiration_date_formatted"] = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
        info["is_expired"] = exp_dt < datetime.now()
        info["valid"] = True
        return info
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "A licença expirou.", "is_expired": True}
    except Exception as e:
        return {"valid": False, "error": f"Licença inválida: {str(e)}", "is_expired": False}

# Validação movida para routes.py sob o prefixo /api/auth/validate-session

@router.get("/companies/by-tenant/{tenant_id}", response_model=CompanyResponse)
def get_company_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    # Busca pela FK direta tenant_id (preferencial) ou fallback para protheus_grupo
    comp = db.query(Company).filter(Company.tenant_id == tenant_id).first()
    if not comp:
        comp = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa nao encontrada para o tenant.")
    return comp
