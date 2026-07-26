"""Pydantic schemas para Tenant — alinhados ao modelo V4."""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class TenantCreate(BaseModel):
    """Payload para criação de um novo tenant."""
    id:                   str            = Field(...,   min_length=2, max_length=100, description="Slug único (ex: elitecorp)")
    name:                 Optional[str]  = Field(None,  description="Nome de exibição")
    tenant_code:          Optional[str]  = Field(None,  description="Código interno")
    tenant_name:          Optional[str]  = Field(None,  description="Nome interno / label")
    protheus_rest_url:    Optional[str]  = Field(None,  description="URL base do REST Protheus")
    protheus_user:        Optional[str]  = Field(None,  description="Usuário REST Protheus")
    protheus_password:    Optional[str]  = Field(None,  description="Senha em claro — será criptografada pelo backend")
    auth_mode:            Optional[str]  = Field('basic', description="basic | token | oauth")
    system_prompt:        Optional[str]  = Field(None,  description="System prompt do agente")
    temperature:          Optional[float]= Field(0.2,   ge=0.0, le=1.0, description="Temperatura LLM (0=preciso, 1=criativo)")
    status:               Optional[str]  = Field('active', description="active | inactive | suspended")
    plan_code:            Optional[str]  = Field(None,  description="Código do plano de licença")

    @field_validator('id')
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        if not re.match(r'^[a-z0-9_\-]+$', v):
            raise ValueError('id deve conter apenas letras minúsculas, números, _ ou -')
        return v


class TenantUpdate(BaseModel):
    """Payload para atualização parcial de um tenant. Todos os campos opcionais."""
    name:                 Optional[str]  = None
    tenant_code:          Optional[str]  = None
    tenant_name:          Optional[str]  = None
    protheus_rest_url:    Optional[str]  = None
    protheus_user:        Optional[str]  = None
    protheus_password:    Optional[str]  = None   # None = não alterar senha
    auth_mode:            Optional[str]  = None
    system_prompt:        Optional[str]  = None
    temperature:          Optional[float]= Field(None, ge=0.0, le=1.0)
    status:               Optional[str]  = None
    plan_code:            Optional[str]  = None


class TenantResponse(BaseModel):
    """Payload de resposta — NUNCA retorna encrypted_protheus_password."""
    id:                str
    name:              Optional[str]  = None
    tenant_code:       Optional[str]  = None
    tenant_name:       Optional[str]  = None
    protheus_rest_url: Optional[str]  = None
    protheus_user:     Optional[str]  = None
    auth_mode:         Optional[str]  = None
    system_prompt:     Optional[str]  = None
    temperature:       Optional[float]= None
    status:            Optional[str]  = None
    plan_code:         Optional[str]  = None
    created_at:        Optional[datetime] = None
    updated_at:        Optional[datetime] = None

    class Config:
        from_attributes = True
