from pathlib import Path

from app.api.business_governance_routes import router as canonical_router
from app.api.governance_routes import router as legacy_router


CANONICAL_SUBPATHS = {
    "/admin/governance/domains",
    "/admin/governance/intents",
    "/admin/governance/semantic-dictionary",
    "/admin/governance/metrics",
    "/admin/governance/dashboards",
    "/admin/governance/business-rules",
    "/admin/governance/health",
}


def test_business_governance_router_is_canonical_admin_contract():
    assert {route.path for route in canonical_router.routes} >= CANONICAL_SUBPATHS
    assert canonical_router.tags == ["business-governance"]


def test_legacy_governance_router_is_explicitly_deprecated():
    assert legacy_router.prefix == "/api/governance"
    assert legacy_router.tags == ["legacy-governance"]
    assert legacy_router.deprecated is True


def test_admin_frontend_does_not_consume_legacy_governance_family():
    frontend = Path("admin-frontend/src")
    forbidden = ("/api/api/governance", "/api/governance")
    matches = []
    for path in frontend.rglob("*"):
        if path.is_file() and path.suffix in {".js", ".jsx", ".ts", ".tsx"}:
            content = path.read_text(encoding="utf-8")
            for marker in forbidden:
                if marker in content:
                    matches.append(f"{path}:{marker}")
    assert matches == [], f"Consumidores legados encontrados: {matches}"
