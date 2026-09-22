import pytest
from fastapi import HTTPException

from app.schemas.company_modules import CompanyModulesSaveRequest
from app.services import company_module_service


class _FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return list(self.rows)


class _FakeDB:
    def __init__(self, tenant_rows, company_rows):
        self.results = [_FakeResult(tenant_rows), _FakeResult(company_rows)]
        self.calls = []

    def execute(self, statement, params=None):
        self.calls.append((str(statement), params or {}))
        return self.results.pop(0)


def test_list_companies_does_not_expose_tenant_id_as_company_id(monkeypatch):
    """Tenant sem company_info não pode virar empresa sintética com id=1."""
    db = _FakeDB(
        tenant_rows=[
            {
                "id": 1,
                "tenant_code": "tenant_fixture",
                "tenant_name": "Tenant Fixture",
                "status": "active",
                "created_at": None,
                "updated_at": None,
            }
        ],
        company_rows=[],
    )
    monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)

    result = company_module_service.list_companies(db)

    assert result == []
    assert len(db.calls) == 2


def test_list_companies_keeps_real_company_info_id(monkeypatch):
    """Empresa persistida mantém seu ID próprio para edição e exclusão."""
    db = _FakeDB(
        tenant_rows=[
            {
                "id": 1,
                "tenant_code": "tenant_fixture",
                "tenant_name": "Tenant Fixture",
                "status": "active",
                "created_at": None,
                "updated_at": None,
            }
        ],
        company_rows=[
            {
                "id": 42,
                "tenant_id": "tenant_fixture",
                "cnpj": "",
                "ie": None,
                "razao_social": "Empresa Fixture",
                "email": None,
                "telefone": None,
                "endereco": None,
                "protheus_grupo": "tenant_fixture",
                "protheus_empresa": "01",
                "protheus_unidade": "01",
                "protheus_filial": "0101",
                "protheus_ambientes": "c8te0u_prod",
                "protheus_usuario": None,
                "protheus_rest_url": None,
                "webapp_url": None,
                "status": "ativa",
                "created_at": None,
                "updated_at": None,
            }
        ],
    )
    monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)

    result = company_module_service.list_companies(db)

    assert len(result) == 1
    assert result[0]["id"] == 42
    assert result[0]["tenant_id"] == "tenant_fixture"


class _ModuleWriteDB:
    def __init__(self):
        self.calls = []
        self.commits = 0
        self.rollbacks = 0

    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, params or {}))
        if "FROM public.protheus_modules_master" in sql:
            return _FakeResult([
                {"mod_code": 2, "mod_sigla": "SIGACOM", "mod_name": "Compras"},
            ])
        return _FakeResult([])

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def test_replace_company_modules_refreshes_active_contract_scope(monkeypatch):
    db = _ModuleWriteDB()
    monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)
    payload = CompanyModulesSaveRequest(
        modules=[{"module_code": "SIGACOM", "enabled": True}],
    )

    saved = company_module_service.replace_company_modules(
        db,
        company_id=1,
        tenant_id="tenant_fixture",
        payload=payload,
    )

    sql = "\n".join(statement for statement, _ in db.calls)
    assert saved == 1
    assert 'INSERT INTO "tenant_fixture".protheus_modules' in sql
    assert "DELETE FROM public.tenant_module_contracts" in sql
    assert "INSERT INTO public.tenant_module_contracts" in sql
    assert 'JOIN "tenant_fixture".protheus_modules tm ON TRUE' in sql
    assert db.commits == 1
    assert db.rollbacks == 0


def test_replace_company_modules_rejects_module_outside_global_catalog(monkeypatch):
    db = _ModuleWriteDB()
    monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)
    payload = CompanyModulesSaveRequest(
        modules=[{"module_code": "SIGAINVALIDO", "enabled": True}],
    )

    with pytest.raises(HTTPException) as exc_info:
        company_module_service.replace_company_modules(
            db,
            company_id=1,
            tenant_id="tenant_fixture",
            payload=payload,
        )

    error = exc_info.value
    assert getattr(error, "status_code", None) == 400
    assert error.detail["code"] == "MODULE_NOT_FOUND"
    assert db.commits == 0
    assert db.rollbacks == 1
