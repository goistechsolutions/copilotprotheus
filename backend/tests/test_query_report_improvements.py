import pytest
from fastapi import HTTPException

from app.services.protheus_context_service import mask_sensitive_rows, validate_query_security
from app.services.report_service import ReportService


def test_query_guard_rejects_select_star():
    sql = "SELECT * FROM SA1010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql, {"SA1010"}, filial="0101")
    assert exc_info.value.status_code == 400
    assert "SELECT *" in str(exc_info.value.detail)


def test_query_guard_requires_oracle_limit_for_non_aggregate():
    sql = "SELECT A1_COD FROM SA1010 WHERE D_E_L_E_T_ <> '*'"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql, {"SA1010"}, filial="0101")
    assert exc_info.value.status_code == 400
    assert "limite Oracle" in str(exc_info.value.detail)


def test_query_guard_requires_logical_filter_per_joined_table():
    sql = (
        "SELECT A.A1_COD, B.C5_NUM "
        "FROM SA1010 A "
        "INNER JOIN SC5010 B ON B.C5_CLIENTE = A.A1_COD "
        "WHERE A.D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    )
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql, {"SA1010", "SC5010"}, filial="0101")
    assert exc_info.value.status_code == 400
    assert "SC5010" in str(exc_info.value.detail)
    assert "D_E_L_E_T_" in str(exc_info.value.detail)


def test_query_guard_rejects_field_outside_authorized_snapshot():
    sql = "SELECT A1_COD, A1_SENHA FROM SA1010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(
            sql,
            {"SA1010"},
            filial="0101",
            allowed_fields={"A1_COD"},
        )
    assert exc_info.value.status_code == 403
    assert "A1_SENHA" in str(exc_info.value.detail)


def test_query_guard_allows_aggregate_without_row_limit():
    sql = "SELECT COUNT(A1_COD) AS TOTAL FROM SA1010 WHERE D_E_L_E_T_ <> '*'"
    validate_query_security(sql, {"SA1010"}, filial="0101", allowed_fields={"A1_COD"})


def test_sensitive_rows_are_masked_without_changing_safe_fields():
    rows = [{"A1_COD": "TEST-001", "API_TOKEN": "secret-test-value", "A1_NOME": "Registro de teste"}]
    result = mask_sensitive_rows(rows)
    assert result == [{
        "A1_COD": "TEST-001",
        "API_TOKEN": "********************",
        "A1_NOME": "Registro de teste",
    }]
    assert rows[0]["API_TOKEN"] == "secret-test-value"


def test_structured_report_normalization_preserves_columns_and_rows():
    columns, rows = ReportService._structured_items(
        [{"DOC": "TEST-001", "VALOR": 10}, {"DOC": "TEST-002", "VALOR": 20}],
        columns=["DOC", "VALOR"],
    )
    assert columns == ["DOC", "VALOR"]
    assert rows == [
        {"DOC": "TEST-001", "VALOR": 10},
        {"DOC": "TEST-002", "VALOR": 20},
    ]


def test_query_guard_allows_presentation_aliases_for_authorized_physical_fields():
    # Fixture sintética: aliases não representam nomes físicos do ERP.
    sql = (
        "SELECT T.SRC_COD AS CODIGO_FORNECEDOR, "
        "T.SRC_EMISSAO AS DATA_EMISSAO_NF, "
        "T.SRC_RECEBIMENTO AS DATA_RECEBIMENTO_NF, "
        "T.SRC_LOJA AS LOJA_FORNECEDOR, "
        "T.SRC_NOME AS NOME_FORNECEDOR "
        "FROM FIXTURE_TABLE T "
        "WHERE T.D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    )
    physical_fields = {
        "SRC_COD",
        "SRC_EMISSAO",
        "SRC_RECEBIMENTO",
        "SRC_LOJA",
        "SRC_NOME",
    }

    validate_query_security(
        sql,
        {"FIXTURE_TABLE"},
        filial="0101",
        allowed_fields=physical_fields,
        allowed_fields_by_table={"FIXTURE_TABLE": physical_fields},
    )


def test_query_guard_still_rejects_unauthorized_physical_field_with_alias():
    sql = (
        "SELECT T.SRC_COD AS CODIGO_FORNECEDOR, "
        "T.SRC_PRIVADO AS NOME_FORNECEDOR "
        "FROM FIXTURE_TABLE T "
        "WHERE T.D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    )

    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(
            sql,
            {"FIXTURE_TABLE"},
            filial="0101",
            allowed_fields={"SRC_COD"},
            allowed_fields_by_table={"FIXTURE_TABLE": {"SRC_COD"}},
        )

    assert exc_info.value.status_code == 403
    assert "SRC_PRIVADO" in str(exc_info.value.detail)


def test_query_guard_allows_explicit_calculated_alias_with_protheus_pattern():
    sql = (
        "SELECT SUM(SF1.F1_VALBRUT) AS F1_TOTAL "
        "FROM SF1010 SF1 "
        "WHERE SF1.D_E_L_E_T_ <> '*'"
    )

    validate_query_security(
        sql,
        {"SF1010"},
        filial="0101",
        allowed_fields={"F1_VALBRUT"},
        allowed_fields_by_table={"SF1010": {"F1_VALBRUT"}},
    )


def test_query_guard_allows_implicit_calculated_alias_with_protheus_pattern():
    sql = (
        "SELECT SUM(SF1.F1_VALBRUT) F1_TOTAL "
        "FROM SF1010 SF1 "
        "WHERE SF1.D_E_L_E_T_ <> '*'"
    )

    validate_query_security(
        sql,
        {"SF1010"},
        filial="0101",
        allowed_fields={"F1_VALBRUT"},
        allowed_fields_by_table={"SF1010": {"F1_VALBRUT"}},
    )


def test_query_guard_rejects_f1_total_when_used_as_nonexistent_physical_field():
    sql = (
        "SELECT SF1.F1_TOTAL "
        "FROM SF1010 SF1 "
        "WHERE SF1.D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    )

    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(
            sql,
            {"SF1010"},
            filial="0101",
            allowed_fields={"F1_VALBRUT"},
            allowed_fields_by_table={"SF1010": {"F1_VALBRUT"}},
        )

    assert exc_info.value.status_code == 403
    assert "SF1.F1_TOTAL" in str(exc_info.value.detail)
    assert "ausente" in str(exc_info.value.detail)
