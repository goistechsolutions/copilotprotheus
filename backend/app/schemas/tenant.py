"""
backend/app/schemas/tenant.py

Pydantic V2 — schemas de Tenant alinhados ao modelo V4.

Atualização:
  TenantCreate / TenantResponse: adicionado protheus_webapp_url para
  registrar a URL do WebApp/admin Protheus junto ao tenant, espelhando
  o campo webapp_url de company_info e o campo do mesmo nome em
  TenantUpdate.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class TenantCreate(BaseModel):
    """Payload para criação de um novo tenant — campos tolerantes contra 422."""
    id:                      Optional[str]   = Field(None,    description="Slug único (ex: elitecorp). Se omitido, é gerado do tenant_code ou name.")
    name:                    Optional[str]   = Field(None,    description="Nome de exibição")
    tenant_code:             Optional[str]   = Field(None,    description="Código interno")
    tenant_name:             Optional[str]   = Field(None,    description="Nome interno / label")
    protheus_rest_url:       Optional[str]   = Field(None,    description="URL base do REST Protheus")
    protheus_webapp_url:     Optional[str]   = Field(None,    description="URL do WebApp / admin Protheus")
    protheus_user:           Optional[str]   = Field(None,    description="Usuário REST Protheus")
    protheus_password:       Optional[str]   = Field(None,    description="Senha em claro — será criptografada pelo backend")
    auth_mode:               Optional[str]   = Field('basic', description="basic | token | oauth")
    system_prompt:           Optional[str]   = Field(None,    description="System prompt do agente")
    temperature:             Optional[float] = Field(0.2,     description="Temperatura LLM (0=preciso, 1=criativo)")
    status:                  Optional[str]   = Field('active',description="active | inactive | suspended")
    plan_code:               Optional[str]   = Field(None,    description="Código do plano de licença")

    @field_validator('id', mode='before')
    @classmethod
    def prepare_id(cls, v):
        if not v or not str(v).strip():
            return None
        import re
        slug = re.sub(r'[^a-z0-9_\-]+', '-', str(v).lower().strip()).strip('-')
        return slug or None

    @field_validator('temperature', mode='before')
    @classmethod
    def prepare_temperature(cls, v):
        if v is None or v == '':
            return 0.2
        try:
            val = float(v)
            return max(0.0, min(1.0, val))
        except (ValueError, TypeError):
            return 0.2

    @field_validator(
        'protheus_password', 'protheus_user', 'protheus_rest_url',
        'protheus_webapp_url', 'tenant_name', 'name', 'tenant_code', 'plan_code',
        mode='before'
    )
    @classmethod
    def clean_empty_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantUpdate(BaseModel):
    """Payload para atualização parcial de um tenant."""
    name:                    Optional[str]   = None
    tenant_code:             Optional[str]   = None
    tenant_name:             Optional[str]   = None
    protheus_rest_url:       Optional[str]   = None
    protheus_webapp_url:     Optional[str]   = None
    protheus_user:           Optional[str]   = None
    protheus_password:       Optional[str]   = None   # None = não alterar senha
    auth_mode:               Optional[str]   = None
    system_prompt:           Optional[str]   = None
    temperature:             Optional[float] = Field(None)
    status:                  Optional[str]   = None
    plan_code:               Optional[str]   = None

    @field_validator('temperature', mode='before')
    @classmethod
    def prepare_temperature(cls, v):
        if v is None or v == '':
            return None
        try:
            val = float(v)
            return max(0.0, min(1.0, val))
        except (ValueError, TypeError):
            return None

    @field_validator(
        'protheus_password', 'protheus_user', 'protheus_rest_url',
        'protheus_webapp_url', 'tenant_name', 'name', 'tenant_code', 'plan_code',
        mode='before'
    )
    @classmethod
    def clean_empty_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantResponse(BaseModel):
    """Payload de resposta — NUNCA retorna encrypted_protheus_password."""
    id:                   str
    name:                 Optional[str]   = None
    tenant_code:          Optional[str]   = None
    tenant_name:          Optional[str]   = None
    protheus_rest_url:    Optional[str]   = None
    protheus_webapp_url:  Optional[str]   = None
    protheus_user:        Optional[str]   = None
    auth_mode:            Optional[str]   = None
    system_prompt:        Optional[str]   = None
    temperature:          Optional[float] = None
    status:               Optional[str]   = None
    plan_code:            Optional[str]   = None
    created_at:           Optional[datetime] = None
    updated_at:           Optional[datetime] = None

    model_config = __import__('pydantic').ConfigDict(from_attributes=True)
