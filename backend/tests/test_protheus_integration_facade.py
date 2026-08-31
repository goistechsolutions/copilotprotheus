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


def test_module_filter_accepts_only_numeric_codes():
    from app.services.sync_dictionary_v52 import _build_modules_in

    assert _build_modules_in(["02", "3"]) == "2, 3"
    with pytest.raises(ValueError, match="códigos numéricos"):
        _build_modules_in(["SIGAFAT"])


def test_metadata_normalization_discards_incomplete_rows():
    from app.services.sync_dictionary_v52 import normalize_metadata_rows

    rows = normalize_metadata_rows("SX3", [
        {"X3_ARQUIVO": " sf1 ", "X3_CAMPO": " f1_doc ", "X3_TIPO": "C"},
        {"X3_ARQUIVO": "SF1", "X3_CAMPO": ""},
    ])
    assert rows == [{
        "source_type": "SX3",
        "table_code": "SF1",
        "field_name": "F1_DOC",
        "title": "",
        "field_type": "C",
        "length_num": None,
        "decimal_num": None,
        "sxg_group": "",
    }]


def test_module_catalog_csv_accepts_pt_br_semicolon_delimiter():
    from app.api.admin_routes import _parse_module_catalog_csv

    records = _parse_module_catalog_csv(
        "\ufeffcodigo;sigla;descricao\n01;SIGAATF;Ativo Fixo\n02;SIGACOM;Compras\n".encode("utf-8")
    )

    assert records == [
        (1, "SIGAATF", "Ativo Fixo"),
        (2, "SIGACOM", "Compras"),
    ]


def test_module_catalog_csv_still_accepts_comma_delimiter():
    from app.api.admin_routes import _parse_module_catalog_csv

    records = _parse_module_catalog_csv(
        "codigo,sigla,descricao\n1,SIGAATF,Ativo Fixo\n".encode("utf-8")
    )

    assert records == [(1, "SIGAATF", "Ativo Fixo")]


def test_module_catalog_csv_rejects_unexpected_header():
    from app.api.admin_routes import ModuleCatalogImportError, _parse_module_catalog_csv

    with pytest.raises(ModuleCatalogImportError, match="Cabeçalho inválido"):
        _parse_module_catalog_csv(b"codigo;nome;descricao\n1;SIGAATF;Ativo Fixo\n")
