import pytest

from app.api.admin_routes import ModuleCatalogImportError, _parse_module_catalog_csv


def test_module_catalog_csv_normalizes_codes_and_descriptions():
    records = _parse_module_catalog_csv(
        "codigo,sigla,descricao\n01,SIGAATF,Ativo Fixo\n02,SIGACOM,Compras\n".encode()
    )

    assert records == [
        (1, "SIGAATF", "Ativo Fixo"),
        (2, "SIGACOM", "Compras"),
    ]


def test_module_catalog_csv_accepts_utf8_bom_and_skips_blank_lines():
    records = _parse_module_catalog_csv(
        b"\xef\xbb\xbfcodigo,sigla,descricao\n05,SIGAFAT,Faturamento\n,,\n"
    )

    assert records == [(5, "SIGAFAT", "Faturamento")]


def test_module_catalog_csv_rejects_extra_columns_and_does_not_accept_data_payload():
    with pytest.raises(ModuleCatalogImportError) as exc_info:
        _parse_module_catalog_csv(
            "codigo,sigla,descricao,registros\n05,SIGAFAT,Faturamento,nao-permitido\n".encode()
        )

    assert exc_info.value.detail.startswith("Cabeçalho inválido")


def test_module_catalog_csv_rejects_duplicate_code_and_sigla():
    with pytest.raises(ModuleCatalogImportError) as exc_info:
        _parse_module_catalog_csv(
            "codigo,sigla,descricao\n05,SIGAFAT,Faturamento\n05,SIGAFAT,Outro\n".encode()
        )

    assert exc_info.value.detail["message"].startswith("CSV rejeitado")
    assert any("codigo duplicado" in error for error in exc_info.value.detail["errors"])
    assert any("sigla duplicada" in error for error in exc_info.value.detail["errors"])
