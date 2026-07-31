from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CompanyBase(BaseModel):
    cnpj: Optional[str] = ""
    ie: Optional[str] = None
    razao_social: Optional[str] = ""
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    protheus_grupo: Optional[str] = ""
    protheus_empresa: Optional[str] = None
    protheus_unidade: Optional[str] = None
    protheus_filial: Optional[str] = "0101"
    protheus_ambientes: Optional[str] = "producao"
    protheus_usuario: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    licenca_uso: Optional[str] = None
    status: Optional[str] = "ativa"
    tenant_id: Optional[str] = None

class CompanyCreate(CompanyBase):
    protheus_password: Optional[str] = None

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
    protheus_password: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    licenca_uso: Optional[str] = None
    status: Optional[str] = None
    tenant_id: Optional[str] = None

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
