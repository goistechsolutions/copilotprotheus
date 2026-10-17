from __future__ import annotations

from .contracts import AIWorkload, LLMProvider


class ModelRouter:
    def __init__(
        self,
        *,
        rag_provider: LLMProvider,
        code_provider: LLMProvider,
    ) -> None:
        self._rag_provider = rag_provider
        self._code_provider = code_provider

    def resolve(self, workload: AIWorkload) -> LLMProvider:
        if workload in {AIWorkload.CORPORATE_RAG, AIWorkload.NARRATIVE}:
            return self._rag_provider
        if workload is AIWorkload.CODE_ASSIST:
            return self._code_provider
        if workload is AIWorkload.DETERMINISTIC:
            raise ValueError(
                "Carga determinística deve usar engines do backend, não um LLM"
            )
        raise ValueError(f"Workload não suportado: {workload}")
