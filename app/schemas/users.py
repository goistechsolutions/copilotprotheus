"""Schemas Pydantic — usuários."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    tenant_id: int
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: str = "user"


class UserOut(BaseModel):
    id: str
    tenant_id: int
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True
