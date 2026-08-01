"""Schemas Pydantic — chat."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    module_context: Optional[str] = None  # Ex: SIGAFAT, SIGAEST, SIGAFIN


class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    tokens_used: int
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: Optional[str]
    module_context: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
