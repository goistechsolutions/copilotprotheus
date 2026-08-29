"""Contratos canônicos para operações Protheus sem dados operacionais persistidos."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IntegrationErrorCode(StrEnum):
    CONTEXT_INVALID = "CONTEXT_INVALID"
    CONNECTION_NOT_FOUND = "CONNECTION_NOT_FOUND"
    PROTHEUS_AUTH_FAILED = "PROTHEUS_AUTH_FAILED"
    PROTHEUS_UNAVAILABLE = "PROTHEUS_UNAVAILABLE"
    PROTHEUS_TIMEOUT = "PROTHEUS_TIMEOUT"
    QUERYREST_REJECTED = "QUERYREST_REJECTED"
    RBAC_TABLE_DENIED = "RBAC_TABLE_DENIED"
    RBAC_FIELD_DENIED = "RBAC_FIELD_DENIED"
    DICTIONARY_UNAVAILABLE = "DICTIONARY_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ProtheusContext(BaseModel):
    """Contexto mínimo que acompanha toda operação direcionada ao ERP."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    tenant_code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_-]{0,99}$")
    environment_code: str = Field(min_length=1, max_length=100)
    company_id: int | None = Field(default=None, ge=1)
    company_code: str | None = Field(default=None, max_length=30)
    branch_code: str | None = Field(default=None, max_length=30)
    module_code: int | None = Field(default=None, ge=1)
    user_id: str | None = Field(default=None, max_length=100)
    role_code: str | None = Field(default=None, max_length=100)

    @field_validator("environment_code")
    @classmethod
    def reject_placeholder_environment(cls, value: str) -> str:
        if value.lower() in {"default", "none", "null", ""}:
            raise ValueError("environment_code Protheus deve ser um ambiente real")
        return value

    def require_company_scope(self) -> "ProtheusContext":
        if self.company_id is None and not self.company_code:
            raise ValueError("company_id ou company_code é obrigatório para operação empresarial")
        return self


class IntegrationErrorResponse(BaseModel):
    """Resposta pública sanitizada; não inclui body remoto, senha ou token."""

    model_config = ConfigDict(extra="forbid")

    success: bool = False
    code: IntegrationErrorCode
    message: str = Field(min_length=1, max_length=500)
    correlation_id: str = Field(min_length=1, max_length=100)
    status_code: int | None = Field(default=None, ge=400, le=599)
    retryable: bool = False
    details: dict[str, Any] | None = None


class DiagnosticStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    status: str = Field(pattern=r"^(pending|running|passed|failed|skipped)$")
    duration_ms: int | None = Field(default=None, ge=0)
    code: IntegrationErrorCode | None = None
    message: str | None = Field(default=None, max_length=500)


class ProtheusConnectionDiagnosticsResponse(BaseModel):
    """Resultado de diagnóstico sem resposta empresarial do ERP."""

    model_config = ConfigDict(extra="forbid")

    success: bool
    context: ProtheusContext
    checked_at: datetime
    correlation_id: str = Field(min_length=1, max_length=100)
    connection_found: bool
    authentication: DiagnosticStep
    queryrest: DiagnosticStep
    dictionary: DiagnosticStep
    steps: list[DiagnosticStep] = Field(default_factory=list)
