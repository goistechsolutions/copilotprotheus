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
