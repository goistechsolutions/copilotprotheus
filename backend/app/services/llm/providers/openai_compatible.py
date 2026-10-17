from __future__ import annotations

import time
from typing import Any

import httpx

from ..contracts import GenerationRequest, GenerationResult


class OpenAICompatibleProvider:
    provider_name = "openvino"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout_seconds: float,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model_name = model
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        messages: list[dict[str, str]] = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        started = time.perf_counter()
        response = await self._client.post(
            f"{self.base_url}/chat/completions",
            json={
                "model": self.model_name,
                "messages": messages,
                "stream": False,
                "max_tokens": request.max_new_tokens,
                "temperature": request.temperature,
            },
            headers={
                "X-Trace-Id": request.trace_id,
                "X-Request-Id": request.request_id,
            },
        )
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        latency_ms = round((time.perf_counter() - started) * 1000)

        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError("Provider OpenVINO retornou resposta sem choices")

        choice = choices[0]
        message = choice.get("message") or {}
        content = str(message.get("content") or "")
        usage = payload.get("usage") or {}

        return GenerationResult(
            content=content,
            provider=self.provider_name,
            model=self.model_name,
            latency_ms=latency_ms,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            finish_reason=choice.get("finish_reason"),
        )

    async def health(self) -> bool:
        try:
            response = await self._client.get(f"{self.base_url}/models")
            return response.is_success
        except httpx.HTTPError:
            return False

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
