from __future__ import annotations

import logging

from .contracts import GenerationRequest, GenerationResult
from .router import ModelRouter

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, router: ModelRouter) -> None:
        self._router = router

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        provider = self._router.resolve(request.workload)
        logger.info(
            "llm_request_started",
            extra={
                "trace_id": request.trace_id,
                "request_id": request.request_id,
                "tenant_id": request.tenant_id,
                "user_id": request.user_id,
                "workload": request.workload.value,
                "provider": provider.provider_name,
                "model": provider.model_name,
            },
        )

        try:
            result = await provider.generate(request)
        except Exception:
            logger.exception(
                "llm_request_failed",
                extra={
                    "trace_id": request.trace_id,
                    "request_id": request.request_id,
                    "tenant_id": request.tenant_id,
                    "workload": request.workload.value,
                    "provider": provider.provider_name,
                    "model": provider.model_name,
                },
            )
            raise

        logger.info(
            "llm_request_completed",
            extra={
                "trace_id": request.trace_id,
                "request_id": request.request_id,
                "tenant_id": request.tenant_id,
                "workload": request.workload.value,
                "provider": result.provider,
                "model": result.model,
                "latency_ms": result.latency_ms,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
            },
        )
        return result
