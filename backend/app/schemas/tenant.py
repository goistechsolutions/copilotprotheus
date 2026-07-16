from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TenantBase(BaseModel):
    id: str = Field(..., description="ID ou código único do Cliente (tenant_id)")
    name: str = Field(..., description="Nome do Cliente")
    protheus_rest_url: Optional[str] = Field("", description="URL do portal REST principal do cliente")
    protheus_user: Optional[str] = Field("", description="Usuário do Protheus")
    auth_mode: Optional[str] = Field("basic", description="Modo de autenticação (ex: basic)")
    system_prompt: Optional[str] = Field("", description="Prompt do sistema para o LLM")
    temperature: Optional[float] = Field(0.7, description="Temperatura do LLM (0.0 a 1.0)")
class TenantCreate(TenantBase):
    protheus_password: Optional[str] = Field("", description="Senha do Protheus (opcional no cadastro inicial)")

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    protheus_rest_url: Optional[str] = None
    protheus_user: Optional[str] = None
    protheus_password: Optional[str] = None
    auth_mode: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
class TenantResponse(TenantBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
