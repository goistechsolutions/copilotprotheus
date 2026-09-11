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


def test_resolve_context_dynamically_routes_module_for_finance_prompt(monkeypatch):
    monkeypatch.setattr(resolver, "resolve_tenant_schema", lambda db, tenant_id: "rodol_prod")
    
    def fake_require_tenant_module(db, schema_name, module):
        if str(module).upper() in ("SIGAFIN", "FINANCEIRO", "6"):
            return {
                "mod_code": "6",
                "mod_sigla": "SIGAFIN",
                "mod_name": "Financeiro",
            }
        return {
            "mod_code": "5",
            "mod_sigla": "SIGAFAT",
            "mod_name": "Faturamento",
        }

    monkeypatch.setattr(resolver, "require_tenant_module", fake_require_tenant_module)

    # O payload veio com module="SIGAFAT" (fixo do front), mas o usuário perguntou sobre fluxo de caixa
    context = resolver.resolve_context(_DB(), {
        "tenant_id": "rodol_prod",
        "environment_code": "c8te0u_prod",
        "company_code": "01",
        "branch": "0101",
        "module": "SIGAFAT",
        "prompt": "fluxo de caixa dos proximos 10 dias",
    })

    assert context.module_sigla == "SIGAFIN"
    assert context.module_code == "6"


def test_resolve_context_preserves_module_when_no_domain_detected(monkeypatch):
    monkeypatch.setattr(resolver, "resolve_tenant_schema", lambda db, tenant_id: "rodol_prod")
    monkeypatch.setattr(
        resolver,
        "require_tenant_module",
        lambda db, schema_name, module: {
            "mod_code": "5",
            "mod_sigla": "SIGAFAT",
            "mod_name": "Faturamento",
        },
    )

    context = resolver.resolve_context(_DB(), {
        "tenant_id": "rodol_prod",
        "environment_code": "c8te0u_prod",
        "company_code": "01",
        "branch": "0101",
        "module": "SIGAFAT",
        "prompt": "mostrar informações diversas",
    })

    assert context.module_sigla == "SIGAFAT"
    assert context.module_code == "5"

