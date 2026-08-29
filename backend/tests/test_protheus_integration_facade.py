import os

os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-with-at-least-32-chars")

import pytest
from pydantic import ValidationError

from app.schemas.protheus_context import ProtheusContext
from app.services.protheus_integration_service import IntegrationFailure, ProtheusIntegrationService


def test_context_rejects_placeholder_environment():
    with pytest.raises(ValidationError):
        ProtheusContext(tenant_code="rodol_prod", environment_code="default")


def test_context_requires_company_for_operational_query():
    context = ProtheusContext(tenant_code="rodol_prod", environment_code="c8te0u_prod")
    with pytest.raises(ValueError, match="company_id ou company_code"):
        context.require_company_scope()


def test_rest_url_requires_https_and_rest_suffix():
    assert ProtheusIntegrationService._validate_base_url("https://erp.example.com/rest") == "https://erp.example.com/rest"

    with pytest.raises(IntegrationFailure, match="HTTPS"):
        ProtheusIntegrationService._validate_base_url("http://erp.example.com/rest")

    with pytest.raises(IntegrationFailure, match="terminar em /rest"):
        ProtheusIntegrationService._validate_base_url("https://erp.example.com")


def test_rest_url_rejects_endpoint_specific_paths():
    with pytest.raises(IntegrationFailure, match="não inclua QueryRest"):
        ProtheusIntegrationService._validate_base_url("https://erp.example.com/rest/QueryRest")

    with pytest.raises(IntegrationFailure, match="não inclua QueryRest"):
        ProtheusIntegrationService._validate_base_url("https://erp.example.com/rest/api/oauth2/v1/token")
