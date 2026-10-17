from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol


class AIWorkload(StrEnum):
    CORPORATE_RAG = "corporate_rag"
    NARRATIVE = "narrative"
    CODE_ASSIST = "code_assist"
    DETERMINISTIC = "deterministic"


@dataclass(frozen=True, slots=True)
class GenerationRequest:
    prompt: str
    tenant_id: str
    user_id: str
    trace_id: str
    request_id: str
    workload: AIWorkload
    system_prompt: str | None = None
    max_new_tokens: int = 512
    temperature: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.prompt.strip():
            raise ValueError("prompt não pode ser vazio")
        if not self.tenant_id.strip():
            raise ValueError("tenant_id é obrigatório")
        if not self.user_id.strip():
            raise ValueError("user_id é obrigatório")
        if not self.trace_id.strip():
            raise ValueError("trace_id é obrigatório")
        if not self.request_id.strip():
            raise ValueError("request_id é obrigatório")
        if not 1 <= self.max_new_tokens <= 4096:
            raise ValueError("max_new_tokens deve estar entre 1 e 4096")
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError("temperature deve estar entre 0.0 e 2.0")


@dataclass(frozen=True, slots=True)
class GenerationResult:
    content: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    finish_reason: str | None = None


class LLMProvider(Protocol):
    provider_name: str
    model_name: str

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        ...

    async def health(self) -> bool:
        ...
