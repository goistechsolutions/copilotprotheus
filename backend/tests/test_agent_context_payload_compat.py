import pytest

import app.services.protheus_context_resolver as resolver


class _Result:
    def __init__(self, row):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row


class _DB:
    def execute(self, statement, params):
        return _Result({
            "id": 1,
            "company_code": "01",
            "branch_code": "0101",
            "status": "ativa",
        })


def test_resolve_context_accepts_legacy_top_level_organization_fields(monkeypatch):
    monkeypatch.setattr(resolver, "resolve_tenant_schema", lambda db, tenant_id: "rodol_prod")
    monkeypatch.setattr(
        resolver,
        "require_tenant_module",
        lambda db, schema_name, module: {
            "mod_code": "2",
            "mod_sigla": "SIGAFAT",
            "mod_name": "Faturamento",
        },
    )

    context = resolver.resolve_context(_DB(), {
        "tenant_id": "rodol_prod",
        "environment_code": "c8te0u_prod",
        "company_code": "01",
        "branch": "0101",
        "filial": "0101",
        "module": "SIGAFAT",
        "user": "admin",
        "profile": "Negócio",
    })

    assert context.tenant_id == "rodol_prod"
    assert context.company_code == "01"
    assert context.branch == "0101"
    assert context.module_sigla == "SIGAFAT"
