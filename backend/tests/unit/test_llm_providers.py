import json

import httpx
import pytest

from app.services.llm.contracts import AIWorkload, GenerationRequest
from app.services.llm.providers.ollama import OllamaProvider
from app.services.llm.providers.openai_compatible import OpenAICompatibleProvider


def request() -> GenerationRequest:
    return GenerationRequest(
        prompt="Explique o resultado validado.",
        tenant_id="tenant-a",
        user_id="user-1",
        trace_id="trace-1",
        request_id="request-1",
        workload=AIWorkload.NARRATIVE,
        max_new_tokens=100,
    )


@pytest.mark.asyncio
async def test_openvino_provider_parseia_resposta() -> None:
    async def handler(req: httpx.Request) -> httpx.Response:
        assert req.url.path == "/v1/chat/completions"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"content": "Resposta"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleProvider(
        base_url="http://test/v1",
        model="phi35",
        timeout_seconds=10,
        client=client,
    )
    result = await provider.generate(request())
    assert result.content == "Resposta"
    assert result.provider == "openvino"
    assert result.output_tokens == 5
    await client.aclose()


@pytest.mark.asyncio
async def test_ollama_provider_parseia_resposta() -> None:
    async def handler(req: httpx.Request) -> httpx.Response:
        assert req.url.path == "/api/generate"
        body = json.loads(req.content)
        assert body["model"] == "qwen2.5-coder:3b"
        return httpx.Response(
            200,
            json={
                "response": "Código",
                "done_reason": "stop",
                "total_duration": 2_000_000_000,
                "prompt_eval_count": 20,
                "eval_count": 10,
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OllamaProvider(
        base_url="http://test",
        model="qwen2.5-coder:3b",
        timeout_seconds=10,
        keep_alive="5m",
        client=client,
    )
    result = await provider.generate(request())
    assert result.content == "Código"
    assert result.provider == "ollama"
    assert result.latency_ms == 2000
    await client.aclose()
