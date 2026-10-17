from __future__ import annotations

import time
from typing import Any

import httpx

from ..contracts import GenerationRequest, GenerationResult


def _ns_to_ms(value: Any) -> int | None:
    if value is None:
        return None
    return round(int(value) / 1_000_000)


class OllamaProvider:
    provider_name = "ollama"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout_seconds: float,
        keep_alive: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model_name = model
        self.keep_alive = keep_alive
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        started = time.perf_counter()
        response = await self._client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model_name,
                "prompt": request.prompt,
                "system": request.system_prompt or "",
                "stream": False,
                "keep_alive": self.keep_alive,
                "options": {
                    "num_predict": request.max_new_tokens,
                    "temperature": request.temperature,
                    "seed": 42,
                },
            },
            headers={
                "X-Trace-Id": request.trace_id,
                "X-Request-Id": request.request_id,
            },
        )
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        measured_latency_ms = round((time.perf_counter() - started) * 1000)
        api_latency_ms = _ns_to_ms(payload.get("total_duration"))

        return GenerationResult(
            content=str(payload.get("response") or ""),
            provider=self.provider_name,
            model=self.model_name,
            latency_ms=api_latency_ms or measured_latency_ms,
            input_tokens=payload.get("prompt_eval_count"),
            output_tokens=payload.get("eval_count"),
            finish_reason=payload.get("done_reason"),
        )

    async def health(self) -> bool:
        try:
            response = await self._client.get(f"{self.base_url}/api/tags")
            return response.is_success
        except httpx.HTTPError:
            return False

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
