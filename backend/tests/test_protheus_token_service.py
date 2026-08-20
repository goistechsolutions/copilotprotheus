import os
os.environ["JWT_SECRET"] = "x" * 32

from datetime import datetime, timedelta, timezone
from app.services.protheus_token_service import _is_token_valid

def test_token_expiring_soon_is_invalid():
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    assert _is_token_valid(expires_at) is False

def test_token_with_safe_expiry_is_valid():
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    assert _is_token_valid(expires_at) is True


def test_queryrest_parser_accepts_bom_and_invalid_escape():
    import httpx
    from app.services.protheus_queryrest_client import _parse_queryrest_json

    response = httpx.Response(
        200,
        content='\ufeff{"items":[{"X3_TITULO":"Descrição \\C"}]}'.encode("utf-8"),
        headers={"content-type": "text/plain; charset=utf-8"},
    )

    parsed = _parse_queryrest_json(response)

    assert parsed["items"][0]["X3_TITULO"] == "Descrição C"


def test_queryrest_parser_rejects_html_without_exposing_body():
    import httpx
    import pytest
    from app.services.protheus_queryrest_client import (
        ProtheusQueryRestError,
        _parse_queryrest_json,
    )

    response = httpx.Response(
        200,
        content=b"<html>AppServer response</html>",
        headers={"content-type": "text/html"},
    )

    with pytest.raises(ProtheusQueryRestError) as exc_info:
        _parse_queryrest_json(response)

    assert exc_info.value.status_code == 200
    assert "AppServer response" not in str(exc_info.value)
