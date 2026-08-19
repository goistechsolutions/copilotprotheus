"""
backend/app/schemas/tenant.py

Pydantic V2 - schemas de Tenant alinhados ao modelo V4 canônico e conexão isolada.
"""

from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ProtheusConnectionPayload(BaseModel):
    """Payload estruturado para a conexão Protheus REST."""
    model_config = ConfigDict(extra="ignore")

    environment_code:        Optional[str]   = Field(None, max_length=100, description="Código do ambiente Protheus")
    base_rest_url:           Optional[str]   = Field(None, max_length=500, description="URL base REST do Protheus")
    auth_mode:               Optional[str]   = Field("oauth", description="oauth | basic | token")
    protheus_username:       Optional[str]   = Field(None, max_length=255, description="Usuário do REST Protheus")
    protheus_password:       Optional[str]   = Field(None, description="Senha do usuário REST Protheus")

    # Aliases de compatibilidade
    protheus_rest_url:       Optional[str]   = None
    protheus_user:           Optional[str]   = None
    protheus_ambiente:       Optional[str]   = None
    ambiente:                Optional[str]   = None

    @field_validator('protheus_password', 'protheus_username', 'protheus_user', 'base_rest_url', 'protheus_rest_url', 'environment_code', mode='before')
    @classmethod
    def clean_empty(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantCreate(BaseModel):
    """Payload para criação de um novo tenant."""
    id:                      Optional[str]   = Field(None, description="Slug único (ex: elitecorp)")
    name:                    Optional[str]   = Field(None, description="Nome de exibição")
    tenant_code:             Optional[str]   = Field(None, description="Código interno")
    tenant_name:             Optional[str]   = Field(None, description="Nome interno / label")
    cnpj:                    Optional[str]   = Field(None, description="CNPJ da empresa")
    status:                  Optional[str]   = Field('active', description="active | inactive | suspended")
    plan_code:               Optional[str]   = Field(None, description="Código do plano de licença")
    licenca_uso:             Optional[str]   = Field(None, description="Licença de uso")
    protheus_webapp_url:     Optional[str]   = Field(None, description="URL do WebApp Protheus")
    system_prompt:           Optional[str]   = Field(None, description="System prompt do agente")
    temperature:             Optional[float] = Field(0.2, description="Temperatura LLM (0=preciso, 1=criativo)")

    # Bloco estruturado de conexão (Recomendado)
    connection:              Optional[ProtheusConnectionPayload] = None

    # Campos legados/planos na raiz para compatibilidade retroativa
    protheus_rest_url:       Optional[str]   = None
    protheus_user:           Optional[str]   = None
    protheus_password:       Optional[str]   = None
    auth_mode:               Optional[str]   = None
    environment_code:        Optional[str]   = None
    protheus_ambiente:       Optional[str]   = None
    ambiente:                Optional[str]   = None

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
        'environment_code',
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
    cnpj:                    Optional[str]   = None
    status:                  Optional[str]   = None
    plan_code:               Optional[str]   = None
    licenca_uso:             Optional[str]   = None
    protheus_webapp_url:     Optional[str]   = None
    system_prompt:           Optional[str]   = None
    temperature:             Optional[float] = Field(None)

    # Bloco estruturado de conexão
    connection:              Optional[ProtheusConnectionPayload] = None

    # Campos legados/planos na raiz para compatibilidade retroativa
    protheus_rest_url:       Optional[str]   = None
    protheus_user:           Optional[str]   = None
    protheus_password:       Optional[str]   = None
    auth_mode:               Optional[str]   = None
    environment_code:        Optional[str]   = None
    protheus_ambiente:       Optional[str]   = None
    ambiente:                Optional[str]   = None

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
        'environment_code',
        mode='before'
    )
    @classmethod
    def clean_empty_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantResponse(BaseModel):
    """Payload de resposta - NUNCA retorna senha ou tokens em claro."""
    id:                   str
    name:                 Optional[str]   = None
    tenant_code:          Optional[str]   = None
    tenant_name:          Optional[str]   = None
    protheus_rest_url:    Optional[str]   = None
    protheus_webapp_url:  Optional[str]   = None
    protheus_user:        Optional[str]   = None
    auth_mode:            Optional[str]   = None
    environment_code:     Optional[str]   = None
    connection:           Optional[Dict[str, Any]] = None
    system_prompt:        Optional[str]   = None
    temperature:          Optional[float] = None
    status:               Optional[str]   = None
    plan_code:            Optional[str]   = None
    cnpj:                 Optional[str]   = None
    licenca_uso:          Optional[str]   = None
    created_at:           Optional[datetime] = None
    updated_at:           Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
