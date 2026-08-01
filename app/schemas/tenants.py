"""Schemas Pydantic — tenants."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TenantOut(BaseModel):
    id: int
    tenant_code: str
    tenant_name: str
    schema_name: str
    status: str
    plan_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
