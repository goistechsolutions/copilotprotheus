from __future__ import annotations

from dataclasses import dataclass
import os


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class LLMSettings:
    rag_base_url: str
    rag_model: str
    code_base_url: str
    code_model: str
    request_timeout_seconds: float
    ollama_keep_alive: str
    audit_enabled: bool

    @classmethod
    def from_env(cls) -> "LLMSettings":
        return cls(
            rag_base_url=os.getenv(
                "LLM_RAG_BASE_URL", "http://127.0.0.1:8000/v1"
            ).rstrip("/"),
            rag_model=os.getenv("LLM_RAG_MODEL", "phi35"),
            code_base_url=os.getenv(
                "LLM_CODE_BASE_URL", "http://127.0.0.1:11434"
            ).rstrip("/"),
            code_model=os.getenv("LLM_CODE_MODEL", "qwen2.5-coder:3b"),
            request_timeout_seconds=float(
                os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "120")
            ),
            ollama_keep_alive=os.getenv("LLM_OLLAMA_KEEP_ALIVE", "5m"),
            audit_enabled=_env_bool("LLM_AUDIT_ENABLED", True),
        )
