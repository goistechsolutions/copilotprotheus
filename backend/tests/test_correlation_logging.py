import asyncio
import os
from types import SimpleNamespace

os.environ.setdefault("JWT_SECRET", "x" * 32)

from app.core.logging_config import (
    get_correlation_id,
    reset_correlation_id,
    set_correlation_id,
)
from app.main import correlation_id_middleware


class FakeResponse:
    def __init__(self):
        self.headers = {}


class FakeRequest:
    def __init__(self, value=None):
        self.headers = {"X-Correlation-ID": value} if value is not None else {}
        self.state = SimpleNamespace()


def test_invalid_header_is_replaced_by_safe_id():
    token = set_correlation_id("not valid with spaces")
    try:
        value = get_correlation_id()
        assert value != "not valid with spaces"
        assert 1 <= len(value) <= 128
    finally:
        reset_correlation_id(token)


def test_middleware_propagates_id_to_response_and_resets_context():
    request = FakeRequest("contract-test-123")

    async def call_next(received_request):
        assert received_request is request
        assert get_correlation_id() == "contract-test-123"
        return FakeResponse()

    response = asyncio.run(correlation_id_middleware(request, call_next))

    assert response.headers["X-Correlation-ID"] == "contract-test-123"
    assert request.state.correlation_id == "contract-test-123"
    assert get_correlation_id() == "-"
