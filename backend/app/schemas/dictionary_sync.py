"""Contratos da sincronização estrutural SX2/SX3/SIX."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DictionarySyncMode(StrEnum):
    FULL = "full"
    CURATED = "curated"


class DictionarySyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    tenant_code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_-]{0,99}$")
    environment_code: str = Field(min_length=1, max_length=100)
    company_id: int | None = Field(default=None, ge=1)
    mode: DictionarySyncMode = DictionarySyncMode.FULL
    module_codes: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("environment_code")
    @classmethod
    def reject_placeholder_environment(cls, value: str) -> str:
        if value.lower() in {"default", "none", "null", ""}:
            raise ValueError("environment_code real é obrigatório")
        return value

    @field_validator("module_codes")
    @classmethod
    def normalize_module_codes(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for raw in values:
            value = str(raw or "").strip()
            if not value.isdigit() or not 0 < int(value) <= 999999:
                raise ValueError("module_codes deve conter somente códigos SX2 numéricos")
            normalized.append(str(int(value)))
        return list(dict.fromkeys(normalized))


class DictionarySourceSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_type: str = Field(pattern=r"^(SX2|SX3|SIX)$")
    status: str = Field(pattern=r"^(pending|loaded|failed|published|skipped)$")
    received_count: int = Field(default=0, ge=0)
    normalized_count: int = Field(default=0, ge=0)
    invalid_count: int = Field(default=0, ge=0)
    error_code: str | None = None


class DictionarySyncDiff(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tables_added: int = Field(default=0, ge=0)
    tables_changed: int = Field(default=0, ge=0)
    tables_removed: int = Field(default=0, ge=0)
    fields_added: int = Field(default=0, ge=0)
    fields_changed: int = Field(default=0, ge=0)
    fields_removed: int = Field(default=0, ge=0)
    indexes_added: int = Field(default=0, ge=0)
    indexes_changed: int = Field(default=0, ge=0)
    indexes_removed: int = Field(default=0, ge=0)


class DictionarySyncPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    tenant_code: str
    environment_code: str
    company_id: int | None = None
    mode: DictionarySyncMode
    generated_at: datetime
    expires_at: datetime
    correlation_id: str
    sources: list[DictionarySourceSummary]
    diff: DictionarySyncDiff
    can_publish: bool
    message: str


class DictionarySyncResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    tenant_code: str
    environment_code: str
    company_id: int | None = None
    mode: DictionarySyncMode
    published_at: datetime
    correlation_id: str
    sources: list[DictionarySourceSummary]
    diff: DictionarySyncDiff
    message: str
