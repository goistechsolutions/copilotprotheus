import pytest
from fastapi import HTTPException

from app.api.knowledge_routes import _safe_filename
from app.api.admin_auth import get_admin_credentials


def test_admin_credentials_require_explicit_environment(monkeypatch):
    monkeypatch.delenv("ADMIN_USER", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("ADMIN_JWT_SECRET", raising=False)

    with pytest.raises(RuntimeError):
        get_admin_credentials()


def test_admin_credentials_accept_valid_explicit_environment(monkeypatch):
    monkeypatch.setenv("ADMIN_USER", "admin-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "temporary-test-password")
    monkeypatch.setenv("ADMIN_JWT_SECRET", "temporary-admin-secret-with-32-chars")

    assert get_admin_credentials() == (
        "admin-test",
        "temporary-test-password",
        "temporary-admin-secret-with-32-chars",
    )


def test_safe_filename_strips_path_components():
    assert _safe_filename("../../document.pdf") == "document.pdf"


def test_safe_filename_rejects_empty_name():
    with pytest.raises(HTTPException) as exc_info:
        _safe_filename("")

    assert exc_info.value.status_code == 400
