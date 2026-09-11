import pytest
from app.api.business_governance_routes import router

def test_business_governance_router_contract():
    routes = [r.path for r in router.routes]
    expected_subpaths = [
        "/admin/governance/domains",
        "/admin/governance/intents",
        "/admin/governance/semantic-dictionary",
        "/admin/governance/metrics",
        "/admin/governance/dashboards",
        "/admin/governance/business-rules",
        "/admin/governance/health",
    ]
    for p in expected_subpaths:
        assert p in routes, f"Sub-rota esperada {p} não está presente no router"
