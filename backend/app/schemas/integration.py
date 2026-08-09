"""
backend/app/schemas/integration.py

Pydantic V2 — schemas de integração Protheus REST.

Atualizado V4:
  ConnectionTestResponse: adicionado tenant_id, company_id, auth_type,
    http_method, message e latency_ms para dar contexto completo no
    resultado de teste de conectividade.
"""

from typing import Optional

from pydantic import BaseModel, Field


class ConnectionTestRequest(BaseModel):
    """Payload opcional para acionar teste de conectividade manualmente."""
    tenant_id: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = None
    rest_url: Optional[str] = Field(None, description="URL base REST Protheus a testar")
    auth_type: Optional[str] = Field("basic", max_length=30, description="basic | token | oauth")


class ConnectionTestResponse(BaseModel):
    ok: bool
    tenant_id: Optional[str] = None
    company_id: Optional[int] = None
    tenant: Optional[str] = Field(None, description="Alias legado — usar tenant_id")
    rest_url: Optional[str] = None
    webapp_url: Optional[str] = None
    auth_type: Optional[str] = None
    http_method: Optional[str] = Field(None, description="GET | POST | HEAD usado no teste")
    status_code: Optional[int] = None
    latency_ms: Optional[int] = Field(None, description="Latência da chamada de teste em ms")
    body_preview: Optional[str] = None
    message: Optional[str] = Field(None, description="Mensagem de diagnóstico legível")
    error: Optional[str] = None
