import pytest
from fastapi import HTTPException

from app.core.admin_security import _admin_access_claims, authorize_admin_access


def test_platform_admin_can_access_any_valid_tenant():
    assert authorize_admin_access(
        {"sub": "admin", "scope_level": "platform", "permissions": ["*"]},
        "business_rules:read",
        "tenant_a",
    ) == "tenant_a"


def test_scoped_admin_can_access_only_configured_tenant():
    admin = {
        "sub": "admin",
        "scope_level": "tenant",
        "tenant_ids": ["tenant_a"],
        "permissions": ["business_rules:read"],
    }

    assert authorize_admin_access(admin, "business_rules:read", "TENANT_A") == "tenant_a"

    with pytest.raises(HTTPException) as error:
        authorize_admin_access(admin, "business_rules:read", "tenant_b")
    assert error.value.status_code == 403


def test_scoped_admin_requires_permission_for_mutations():
    admin = {
        "sub": "admin",
        "scope_level": "tenant",
        "tenant_ids": ["tenant_a"],
        "permissions": ["business_rules:read"],
    }

    with pytest.raises(HTTPException) as error:
        authorize_admin_access(admin, "business_rules:write", "tenant_a")
    assert error.value.status_code == 403


def test_public_or_missing_tenant_is_rejected():
    with pytest.raises(HTTPException) as error:
        authorize_admin_access({"sub": "admin", "scope_level": "platform", "permissions": ["*"]}, "business_rules:read", "public")
    assert error.value.status_code == 400


def test_tenant_scope_requires_an_explicit_tenant_list(monkeypatch):
    monkeypatch.setenv("ADMIN_SCOPE_LEVEL", "tenant")
    monkeypatch.delenv("ADMIN_TENANT_IDS", raising=False)

    with pytest.raises(RuntimeError, match="ADMIN_TENANT_IDS"):
        _admin_access_claims()
