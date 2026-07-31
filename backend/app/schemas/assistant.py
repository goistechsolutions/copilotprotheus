"""
backend/app/schemas/assistant.py

Pydantic V2 — schemas de requisição e resposta do endpoint /ask do Copilot Protheus.

Atualizações V4:
  AskRequest: adicionar company_id, env_id, snapshot_id para rastreabilidade
    direta nos campos de AgentQueryAudit.
  AskResponse: adicionar request_id, execution_status, rows_returned,
    response_time_ms para fechar o ciclo de auditoria na resposta ao frontend.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Request ──────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Pergunta em linguagem natural")

    # Contexto de tenant / empresa
    tenant_id: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = Field(None, description="ID interno de company_info")
    env_id: Optional[UUID] = Field(None, description="UUID do environment ativo")
    snapshot_id: Optional[UUID] = Field(None, description="UUID do snapshot de dicionário ativo")

    # Contexto do usuário Protheus
    user: Optional[str] = None
    password: Optional[str] = None
    protheus_token: Optional[str] = None
    session_id: Optional[str] = None
    company: Optional[str] = Field(None, description="Código de empresa Protheus (ex: 01)")
    branch: Optional[str] = Field(None, description="Código de filial (ex: 0101)")
    environment: Optional[str] = Field(None, description="producao | homologacao | dev")
    station: Optional[str] = None

    # Contexto semântico
    module: Optional[str] = None
    intent: Optional[str] = None
    protheus_data: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None
    screen_text: Optional[str] = None
    image: Optional[str] = Field(None, description="Base64 de imagem de contexto (screenshot)")

    # Credenciais alternativas do agente
    agent_user: Optional[str] = None
    agent_password: Optional[str] = None


# ─── Response ─────────────────────────────────────────────────────────────────

class AskResponse(BaseModel):
    answer: str

    # Metadados de rastreabilidade V4
    request_id: Optional[str] = Field(None, max_length=120)
    execution_status: Optional[str] = Field(None,
        description="planned | running | success | error | blocked")
    rows_returned: Optional[int] = None
    response_time_ms: Optional[int] = None

    # Contexto semântico
    intent: Optional[str] = None
    backend: Optional[str] = None
    module: Optional[str] = None

    # SQL
    sql: Optional[str] = None
    technical_sql: Optional[str] = None

    # Alertas
    warnings: Optional[List[str]] = None

    # Fontes / dados
    sources: Optional[List[Dict[str, Any]]] = None
    datasets: Optional[List[Dict[str, Any]]] = None

    # Visualização
    labels: Optional[List[str]] = None
    tipo_grafico: Optional[str] = None
    titulo: Optional[str] = None
    insights: Optional[str] = None

    # Resposta em camadas
    executive_summary: Optional[str] = None
    applied_filters: Optional[List[str]] = None
    details: Optional[str] = None
    kpis: Optional[List[Dict[str, Any]]] = None
    action_buttons: Optional[List[Dict[str, str]]] = None

    # Auditoria completa
    audit_trail: Optional[Dict[str, Any]] = None
