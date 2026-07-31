"""
backend/app/schemas/knowledge.py

Pydantic V2 — schemas de Knowledge alinhados aos models ORM V4:
  Document, DocumentChunk, Memory, AgentQueryAudit (tenant), AuditLog (public).

Referências em models/knowledge.py:
  Memory.tags → JSONB (dict/list)  Memory.confidence → Integer
  Document.visibility, Document.tenant_id
  AgentQueryAudit → campos V4 completos (tenant_id, company_id, env_id,
    user_id, request_id, execution_status, rows_returned, response_time_ms, ...)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Document ─────────────────────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    source_path: str = Field(..., max_length=1024)
    source_type: str = Field("file", max_length=50)
    module: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    version: Optional[str] = Field(None, max_length=50)
    status: str = Field("active", max_length=50)
    checksum: Optional[str] = Field(None, max_length=64)
    language: str = Field("pt-BR", max_length=10)
    visibility: str = Field("tenant", max_length=20, description="tenant | global")
    tenant_id: Optional[str] = Field(None, max_length=100)


class DocumentOut(DocumentCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── DocumentChunk ────────────────────────────────────────────────────────────

class DocumentChunkCreate(BaseModel):
    document_id: int
    chunk_order: int
    content: str
    token_count: Optional[int] = None
    embedding_model: Optional[str] = Field(None, max_length=100)
    page_number: Optional[int] = None
    section: Optional[str] = Field(None, max_length=255)


class DocumentChunkOut(DocumentChunkCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Memory ───────────────────────────────────────────────────────────────────

class MemoryCreate(BaseModel):
    memory_key: str = Field(..., min_length=1, max_length=255)
    memory_value: str
    memory_type: str = Field("fact", max_length=50)
    scope: Optional[str] = Field("project", max_length=100)
    # tags alinhado ao JSONB do modelo — aceita dict, list ou None
    tags: Optional[Any] = Field(None, description="JSON livre: lista de strings ou dict de categorias")
    # confidence alinhado ao Integer do modelo (0-100)
    confidence: Optional[int] = Field(100, ge=0, le=100)
    source: Optional[str] = Field(None, max_length=255)
    expires_at: Optional[datetime] = None
    visibility: str = Field("tenant", max_length=20)
    tenant_id: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = None


class MemoryOut(MemoryCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── AgentQueryAudit (tenant) — V4 ───────────────────────────────────────────

class AuditCreate(BaseModel):
    """
    Alinhado a AgentQueryAudit (tenant) — tabela operacional por tenant.
    Todos os campos opcionais para permitir criação parcial (ex: antes da
    execução SQL, quando só temos prompt e request_id).
    """
    tenant_id: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = None
    env_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    snapshot_id: Optional[UUID] = None
    request_id: Optional[str] = Field(None, max_length=120)
    natural_language_prompt: Optional[str] = None
    generated_sql: Optional[str] = None
    sql_hash: Optional[str] = Field(None, max_length=128)
    execution_status: str = Field("planned", max_length=20,
        description="planned | running | success | error | blocked")
    rows_returned: Optional[int] = None
    response_time_ms: Optional[int] = None
    blocked_reason: Optional[str] = Field(None, max_length=255)
    tables_used: Optional[str] = None


class AuditOut(AuditCreate):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Listagem paginada ────────────────────────────────────────────────────────

class AuditListResponse(BaseModel):
    total: int
    items: List[AuditOut]


class DocumentListResponse(BaseModel):
    total: int
    items: List[DocumentOut]


class MemoryListResponse(BaseModel):
    total: int
    items: List[MemoryOut]
