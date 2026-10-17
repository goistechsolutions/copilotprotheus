from __future__ import annotations

from .providers import OllamaProvider, OpenAICompatibleProvider
from .router import ModelRouter
from .service import LLMService
from .settings import LLMSettings


def build_llm_service(settings: LLMSettings | None = None) -> LLMService:
    settings = settings or LLMSettings.from_env()

    rag_provider = OpenAICompatibleProvider(
        base_url=settings.rag_base_url,
        model=settings.rag_model,
        timeout_seconds=settings.request_timeout_seconds,
    )
    code_provider = OllamaProvider(
        base_url=settings.code_base_url,
        model=settings.code_model,
        timeout_seconds=settings.request_timeout_seconds,
        keep_alive=settings.ollama_keep_alive,
    )

    return LLMService(
        ModelRouter(
            rag_provider=rag_provider,
            code_provider=code_provider,
        )
    )
