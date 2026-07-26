from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    source_path: str
    source_type: str = 'file'
    module: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    status: str = 'active'
    checksum: Optional[str] = None
    language: str = 'pt-BR'

class DocumentOut(DocumentCreate):
    id: int
    created_at: datetime
    updated_at: datetime

class MemoryCreate(BaseModel):
    memory_key: str
    memory_value: str
    memory_type: str = 'fact'
    scope: str = 'project'
    tags: Optional[str] = None
    confidence: float = 1.0
    source: Optional[str] = None
    expires_at: Optional[datetime] = None

class MemoryOut(MemoryCreate):
    id: int
    created_at: datetime
    updated_at: datetime

class AuditCreate(BaseModel):
    user_name: Optional[str] = None
    session_id: Optional[str] = None
    question: str
    answer: Optional[str] = None
    module: Optional[str] = None
    document_ids: Optional[str] = None
    memory_ids: Optional[str] = None
    sql_used: bool = False
    rag_used: bool = False

class AuditOut(AuditCreate):
    id: int
    created_at: datetime
