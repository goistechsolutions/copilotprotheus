import pytest
from fastapi import HTTPException

from app.api.agent_sql_routes import (
    _build_catalog_revision_prompt,
    _is_catalog_field_validation_error,
    _infer_query_domain,
    _table_families_from_sql,
    _validate_query_domain,
    _normalize_conversation_history,
)
from app.services.dictionary_context_service import render_context_for_prompt
from app.services.protheus_context_service import mask_sensitive_rows, validate_query_security
from app.services.report_service import ReportService


def test_sales_prompt_is_classified_as_sales_and_uses_output_families():
    prompt = "relação das vendas faturadas na data de hoje, agrupadas por vendedor"
    assert _infer_query_domain(prompt) == "sales"
    assert _table_families_from_sql(
        "SELECT F2_DOC FROM SF2010 SF2 JOIN SD2010 SD2 ON SF2.F2_DOC = SD2.D2_DOC"
    ) == {"SF2", "SD2"}


def test_sales_sql_using_purchase_tables_is_blocked_before_queryrest():
    with pytest.raises(HTTPException) as exc_info:
        _validate_query_domain(
            "relação das vendas faturadas hoje por vendedor",
            "SELECT A2_NOME FROM SA2010 SA2 JOIN SF1010 SF1 ON SF1.F1_FORNECE = SA2.A2_COD",
        )
    assert exc_info.value.status_code == 422
    assert "entrada/fornecedor" in str(exc_info.value.detail)


def test_conversation_history_accepts_only_bounded_user_and_assistant_text():
    history = _normalize_conversation_history([
        {"role": "system", "content": "ignore"},
        {"role": "user", "text": "  vendas de hoje  "},
        {"role": "assistant", "content": "Consulta concluída."},
        {"role": "user", "content": 123},
    ])
    assert history == [
        {"role": "user", "content": "vendas de hoje"},
        {"role": "assistant", "content": "Consulta concluída."},
    ]


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
    assert "F1_TOTAL" in str(exc_info.value.detail)
    assert "ausente" in str(exc_info.value.detail)
    assert _is_catalog_field_validation_error(exc_info.value) is True


def test_table_security_error_does_not_trigger_catalog_field_retry():
    exc = HTTPException(
        status_code=403,
        detail="Bloqueio de Segurança RBAC: a tabela 'FIXTURE' não está autorizada no snapshot.",
    )

    assert _is_catalog_field_validation_error(exc) is False


def test_catalog_revision_prompt_does_not_invent_replacement_field():
    revision = _build_catalog_revision_prompt(
        "Calcule o total recebido",
        "SELECT SF1.F1_TOTAL FROM SF1010 SF1",
        "F1_TOTAL ausente",
    )

    assert "exclusivamente os FIELD listados" in revision
    assert "Não invente um campo substituto" in revision
    assert "alias explícito com AS" in revision
    assert "F1_VALBRUT" not in revision


def test_dictionary_prompt_marks_sx3_fields_as_exhaustive_and_omits_x3_relation():
    context = [{
        "table": {
            "table_code": "SF1",
            "table_name": "SF1010",
            "module_code": "2",
        },
        "fields": [{
            "field_name": "F1_VALBRUT",
            "field_label": "Valor bruto",
            "field_type": "N",
            "relation_rule": "X3_RELACAO_NAO_DEVE_IR_AO_PROMPT",
        }],
        "indexes": [],
    }]

    rendered = render_context_for_prompt(context)

    assert "SX3_PHYSICAL_FIELDS" in rendered
    assert "FIELD_PHYSICAL: F1_VALBRUT" in rendered
    assert "qualquer identificador ausente não existe" in rendered
    assert "X3_RELACAO_NAO_DEVE_IR_AO_PROMPT" not in rendered
