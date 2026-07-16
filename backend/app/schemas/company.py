from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CompanyBase(BaseModel):
    cnpj: str
    ie: Optional[str] = None
    razao_social: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    protheus_grupo: str
    protheus_empresa: Optional[str] = None
    protheus_unidade: Optional[str] = None
    protheus_filial: str
    protheus_ambientes: Optional[str] = "producao"
    protheus_usuario: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    licenca_uso: Optional[str] = None
    status: str = "ativa"

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    cnpj: Optional[str] = None
    ie: Optional[str] = None
    razao_social: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    protheus_grupo: Optional[str] = None
    protheus_empresa: Optional[str] = None
    protheus_unidade: Optional[str] = None
    protheus_filial: Optional[str] = None
    protheus_ambientes: Optional[str] = None
    protheus_usuario: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    licenca_uso: Optional[str] = None
    status: Optional[str] = None

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LicenseGenerateRequest(BaseModel):
    cnpj: str
    expiration_date: str  # YYYY-MM-DD
    plan_level: str = "standard"

class LicenseVerifyRequest(BaseModel):
    token: str
    cnpj: Optional[str] = None

class SessionValidateRequest(BaseModel):
    tenant_id: str
    user: str
