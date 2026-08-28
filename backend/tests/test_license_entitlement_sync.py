from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services.license_service import (
    generate_license,
    sync_license_entitlement,
    verify_license,
)


@dataclass
class FakeMappings:
    row: dict | None

    def first(self):
        return self.row


class FakeResult:
    def __init__(self, *, row=None, scalar_value=None):
        self._row = row
        self._scalar_value = scalar_value

    def mappings(self):
        return FakeMappings(self._row)

    def scalar(self):
        return self._scalar_value


class FakeDB:
    def __init__(self, *, plan=None, contract=None):
        self.plan = plan
        self.contract = contract
        self.statements: list[tuple[str, dict]] = []
        self.commits = 0

    def execute(self, query, params=None):
        sql = str(query)
        bound = dict(params or {})
        self.statements.append((sql, bound))
        if "FROM public.license_plans" in sql:
            return FakeResult(row=self.plan)
        if "FROM public.tenant_contracts" in sql:
            return FakeResult(row=self.contract)
        if "INSERT INTO public.tenant_contracts" in sql:
            return FakeResult(scalar_value="contract-fixture")
        return FakeResult()

    def commit(self):
        self.commits += 1


def _token(plan="starter"):
    return generate_license("02.524.305/0001-28", "2099-12-31", plan)


def test_verify_license_normalizes_cnpj_formatting():
    token = _token()

    claims = verify_license(token, expected_cnpj="02524305000128")

    assert claims["cnpj"] == "02524305000128"


def test_sync_license_requires_existing_active_plan():
    db = FakeDB(plan=None)

    with pytest.raises(ValueError, match="não existe ou está inativo"):
        sync_license_entitlement(
            db,
            tenant_code="rodol_prod",
            tenant_schema="rodol_prod",
            plan_code="starter",
            license_token=_token(),
            cnpj="02.524.305/0001-28",
        )

    assert db.commits == 0


def test_sync_license_creates_isolated_contract_and_copies_selected_modules():
    db = FakeDB(plan={"plan_id": "plan-fixture", "plan_code": "starter"})

    result = sync_license_entitlement(
        db,
        tenant_code="rodol_prod",
        tenant_schema="rodol_prod",
        plan_code="starter",
        license_token=_token(),
        cnpj="02.524.305/0001-28",
    )

    sql = "\n".join(statement for statement, _ in db.statements)
    assert result["contract_id"] == "contract-fixture"
    assert result["plan_code"] == "starter"
    assert "INSERT INTO public.tenant_contracts" in sql
    assert 'FROM "rodol_prod".protheus_modules tm' in sql
    assert "INSERT INTO public.tenant_module_contracts" in sql
    assert db.commits == 1


def test_sync_license_updates_only_deterministic_legacy_contract():
    db = FakeDB(
        plan={"plan_id": "plan-fixture", "plan_code": "starter"},
        contract={"contract_id": "legacy-contract"},
    )

    result = sync_license_entitlement(
        db,
        tenant_code="rodol_prod",
        tenant_schema="rodol_prod",
        plan_code="starter",
        license_token=_token(),
        cnpj="02524305000128",
    )

    statements = [(sql, params) for sql, params in db.statements]
    lookup = next(params for sql, params in statements if "FROM public.tenant_contracts" in sql)
    sql = "\n".join(statement for statement, _ in statements)
    assert lookup["contract_code"] == "license:rodol_prod"
    assert result["contract_id"] == "legacy-contract"
    assert "UPDATE public.tenant_contracts" in sql
    assert "INSERT INTO public.tenant_contracts" not in sql
    assert db.commits == 1


def test_sync_license_without_token_leaves_contracts_untouched():
    db = FakeDB(plan={"plan_id": "plan-fixture", "plan_code": "starter"})

    result = sync_license_entitlement(
        db,
        tenant_code="rodol_prod",
        tenant_schema="rodol_prod",
        plan_code="starter",
        license_token=None,
        cnpj="02524305000128",
    )

    assert result is None
    assert db.statements == []
    assert db.commits == 0
