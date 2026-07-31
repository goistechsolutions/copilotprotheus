"""
backend/app/schemas/company.py

Pydantic V2 — schemas de Company alinhados ao model ORM Company (company_info)
na versão V4 multi-tenant (schema dinâmico por tenant via search_path).

Colunas de referência em models/knowledge.py → class Company:
  id, tenant_id, company_code, branch_code, company_name, cnpj, ie,
  razao_social, email, telefone, endereco, protheus_grupo, protheus_empresa,
  protheus_unidade, protheus_filial, environment, protheus_ambientes,
  webapp_url, protheus_rest_url, protheus_usuario, encrypted_protheus_password,
  auth_mode, status, system_prompt, temperature, created_at, updated_at
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Base ─────────────────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    # Identificação Protheus
    company_code: Optional[str] = Field(None, max_length=60, description="Código de empresa Protheus (ex: 01)")
    branch_code: Optional[str] = Field(None, max_length=60, description="Código de filial Protheus (ex: 0101)")
    company_name: Optional[str] = Field(None, max_length=200, description="Nome fantasia / label de exibição")

    # Dados cadastrais
    cnpj: Optional[str] = Field(None, max_length=30)
    ie: Optional[str] = Field(None, max_length=30)
    razao_social: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    telefone: Optional[str] = Field(None, max_length=50)
    endereco: Optional[str] = Field(None, max_length=500)

    # Conexão Protheus
    protheus_grupo: Optional[str] = Field(None, max_length=20)
    protheus_empresa: Optional[str] = Field(None, max_length=20)
    protheus_unidade: Optional[str] = Field(None, max_length=20)
    protheus_filial: Optional[str] = Field("0101", max_length=30)
    environment: Optional[str] = Field("producao", max_length=60)
    protheus_ambientes: Optional[str] = Field("producao", max_length=100)
    protheus_rest_url: Optional[str] = None
    webapp_url: Optional[str] = Field(None, description="URL WebApp / admin Protheus")
    protheus_usuario: Optional[str] = Field(None, max_length=100)
    auth_mode: Optional[str] = Field("basic", max_length=30, description="basic | token | oauth")

    # Configuração do agente
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(0.20, ge=0.0, le=1.0)

    # Controle
    tenant_id: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("active", max_length=20)


# ─── Create ───────────────────────────────────────────────────────────────────

class CompanyCreate(CompanyBase):
    """Criação de empresa — company_code e company_name são obrigatórios."""
    company_code: str = Field(..., min_length=1, max_length=60)
    company_name: str = Field(..., min_length=1, max_length=200)
    protheus_password: Optional[str] = Field(None, description="Senha em claro — será criptografada pelo backend")


# ─── Update ───────────────────────────────────────────────────────────────────

class CompanyUpdate(BaseModel):
    """Atualização parcial — todos os campos são opcionais."""
    company_code: Optional[str] = Field(None, max_length=60)
    branch_code: Optional[str] = Field(None, max_length=60)
    company_name: Optional[str] = Field(None, max_length=200)
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
    environment: Optional[str] = None
    protheus_ambientes: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    webapp_url: Optional[str] = None
    protheus_usuario: Optional[str] = None
    protheus_password: Optional[str] = None
    auth_mode: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    status: Optional[str] = None
    tenant_id: Optional[str] = None


# ─── Response ─────────────────────────────────────────────────────────────────

class CompanyResponse(CompanyBase):
    """Resposta pública — NUNCA retorna encrypted_protheus_password."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Licença ──────────────────────────────────────────────────────────────────

class LicenseGenerateRequest(BaseModel):
    cnpj: str
    expiration_date: str = Field(..., description="YYYY-MM-DD")
    plan_level: str = "standard"


class LicenseVerifyRequest(BaseModel):
    token: str
    cnpj: Optional[str] = None


# ─── Validação de sessão ──────────────────────────────────────────────────────

class SessionValidateRequest(BaseModel):
    tenant_id: str
    user: str
