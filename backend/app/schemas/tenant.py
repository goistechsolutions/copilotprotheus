"""Contratos de API de tenant e conexão REST Protheus."""

from datetime import datetime
from typing import Optional, Dict, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


_REAL_ENVIRONMENT_ERROR = (
    "environment_code Protheus é obrigatório e deve identificar um ambiente real."
)


class ProtheusConnectionPayload(BaseModel):
    """Conexão operacional resolvida exclusivamente por tenant e ambiente."""

    model_config = ConfigDict(extra="forbid")

    environment_code: str = Field(..., min_length=1, max_length=100)
    base_rest_url: str = Field(..., min_length=1, max_length=500)
    auth_mode: Literal["oauth2_password"] = "oauth2_password"
    protheus_username: str = Field(..., min_length=1, max_length=255)
    protheus_password: Optional[str] = Field(default=None, min_length=1)

    @field_validator("environment_code", "base_rest_url", "protheus_username", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> str:
        if value is None or not str(value).strip():
            raise ValueError("campo obrigatório não pode ser vazio")
        return str(value).strip()

    @field_validator("environment_code")
    @classmethod
    def validate_real_environment(cls, value: str) -> str:
        if value.lower() in {"default", "none", "null"}:
            raise ValueError(_REAL_ENVIRONMENT_ERROR)
        return value

    @field_validator("base_rest_url")
    @classmethod
    def validate_base_rest_url(cls, value: str) -> str:
        normalized = value.rstrip("/")
        if not normalized.lower().startswith(("http://", "https://")):
            raise ValueError("base_rest_url deve iniciar com http:// ou https://")
        if normalized.lower().endswith("/queryrest") or normalized.lower().endswith("/api/oauth2/v1/token"):
            raise ValueError("base_rest_url não deve incluir endpoint de operação")
        return normalized

    @field_validator("protheus_password", mode="before")
    @classmethod
    def omit_empty_password(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


class TenantCreate(BaseModel):
    """Payload cadastral de criação, com conexão opcional e estruturada."""

    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = Field(default=None, description="Slug único")
    name: Optional[str] = None
    tenant_code: Optional[str] = None
    cnpj: Optional[str] = None
    status: str = "active"
    plan_code: Optional[str] = None
    licenca_uso: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(default=0.2, ge=0.0, le=1.0)
    connection: Optional[ProtheusConnectionPayload] = None

    @field_validator("id", "tenant_code", "name", "plan_code", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("id")
    @classmethod
    def prepare_id(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        import re
        slug = re.sub(r"[^a-z0-9_\-]+", "-", value.lower()).strip("-")
        return slug or None


class TenantUpdate(BaseModel):
    """Payload parcial de atualização cadastral e/ou de conexão."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    tenant_code: Optional[str] = None
    cnpj: Optional[str] = None
    status: Optional[str] = None
    plan_code: Optional[str] = None
    licenca_uso: Optional[str] = None
    protheus_webapp_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    connection: Optional[ProtheusConnectionPayload] = None

    @field_validator("name", "tenant_code", "plan_code", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


class TenantResponse(BaseModel):
    """Resposta sem senha, token ou campos cifrados."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: Optional[str] = None
    tenant_code: Optional[str] = None
    connection: Optional[Dict[str, Any]] = None
    protheus_webapp_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    status: Optional[str] = None
    plan_code: Optional[str] = None
    cnpj: Optional[str] = None
    licenca_uso: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
