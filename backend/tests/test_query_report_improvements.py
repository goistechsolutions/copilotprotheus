import pytest
from fastapi import HTTPException

from app.api.agent_sql_routes import (
    _build_catalog_revision_prompt,
    _is_catalog_field_validation_error,
    _infer_query_domain,
    _table_families_from_sql,
    _validate_query_domain,
    _normalize_conversation_history,
    _domain_context_block,
)
from app.services.dictionary_context_service import render_context_for_prompt
from app.services.protheus_context_service import auto_fix_delet_filters, mask_sensitive_rows, validate_query_security
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


def test_sales_domain_is_blocked_when_active_snapshot_is_purchases_only():
    context = [{
        "table": {"table_code": "SF1", "table_name": "SF1010", "module_code": "2"},
        "fields": [{"field_name": "F1_DOC"}],
    }]
    message = _domain_context_block("vendas faturadas hoje", context)
    assert message is not None
    assert "não contêm SF2/SD2/SA1" in message


def test_sales_domain_is_accepted_when_output_snapshot_is_present():
    context = [{
        "table": {"table_code": "SF2", "table_name": "SF2010", "module_code": "5"},
        "fields": [{"field_name": "F2_DOC"}],
    }]
    assert _domain_context_block("vendas faturadas hoje", context) is None


def test_conversation_history_accepts_only_bounded_user_and_assistant_text():
    history = _normalize_conversation_history([
        {"role": "system", "content": "ignore"},
        {"role": "user", "text": "  vendas de hoje  "},
        {"role": "assistant", "content": "Consulta concluída."},
        {"role": "user", "content": 123},
    ])
    assert history == [
        {"role": "user", "text": "vendas de hoje"},
        {"role": "assistant", "text": "Consulta concluída."},
    ]


def test_query_guard_rejects_select_star():
    sql = "SELECT * FROM SA1010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql, {"SA1010"}, filial="0101")
    assert exc_info.value.status_code == 400
    assert "SELECT *" in str(exc_info.value.detail)


def test_query_guard_allows_queries_without_oracle_limit():
    sql = "SELECT A1_COD FROM SA1010 WHERE D_E_L_E_T_ <> '*'"
    # Não deve subir HTTPException
    validate_query_security(sql, {"SA1010"}, filial="0101")


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


def test_query_guard_allows_select_alias_in_group_by_and_order_by():
    sql = (
        "SELECT SUBSTR(SF2.F2_EMISSAO, 1, 6) AS MES_ANO, SUM(SD2.D2_TOTAL) AS VALOR_TOTAL "
        "FROM SF2010 SF2 "
        "INNER JOIN SD2010 SD2 ON SD2.D2_FILIAL = SF2.F2_FILIAL AND SD2.D2_DOC = SF2.F2_DOC AND SD2.D2_SERIE = SF2.F2_SERIE "
        "WHERE SF2.D_E_L_E_T_ <> '*' AND SD2.D_E_L_E_T_ <> '*' "
        "GROUP BY MES_ANO "
        "ORDER BY MES_ANO DESC"
    )
    allowed_tables = {"SF2010", "SD2010"}
    fields_by_table = {
        "SF2010": {"F2_FILIAL", "F2_DOC", "F2_SERIE", "F2_EMISSAO"},
        "SD2010": {"D2_FILIAL", "D2_DOC", "D2_SERIE", "D2_TOTAL"},
    }
    # MES_ANO and VALOR_TOTAL are aliases in SELECT, not physical SX3 fields.
    # validate_query_security should NOT raise RBAC exception for MES_ANO in GROUP BY or ORDER BY.
    assert validate_query_security(
        sql=sql,
        allowed_tables=allowed_tables,
        filial="0101",
        allowed_fields_by_table=fields_by_table,
        filter_fields_by_table=fields_by_table,
    ) is True


def test_domain_validation_blocks_purchases_when_domain_is_inherited_as_sales():
    with pytest.raises(HTTPException) as exc_info:
        _validate_query_domain(
            prompt="Comparar com periodo anterior",
            sql="SELECT A2_NOME FROM SA2010 SA2 JOIN SF1010 SF1 ON SF1.F1_FORNECE = SA2.A2_COD",
            domain="sales",
        )
    assert exc_info.value.status_code == 422
    assert "entrada/fornecedor" in str(exc_info.value.detail)


def test_domain_context_block_triggers_with_inherited_domain():
    context = [{
        "table": {"table_code": "SF1", "table_name": "SF1010", "module_code": "2"},
        "fields": [{"field_name": "F1_DOC"}],
    }]
    # Prompt has no explicit sales words, but domain is passed as "sales"
    diag = _domain_context_block("Comparar com periodo anterior", context, domain="sales")
    assert diag is not None
    assert diag["intent"] == "sales_billing"
    assert "SF2" in diag["required_tables"]


def test_auto_fix_delet_filters_injects_when_missing():
    # 1. Single table without WHERE
    sql1 = "SELECT A1_COD FROM SA1010 A1"
    fixed1 = auto_fix_delet_filters(sql1)
    assert "WHERE A1.D_E_L_E_T_ <> '*'" in fixed1

    # 2. Multiple tables with existing WHERE
    sql2 = "SELECT F2_DOC FROM SF2010 SF2 JOIN SD2010 SD2 ON SF2.F2_DOC = SD2.D2_DOC WHERE SF2.F2_FILIAL = '01'"
    fixed2 = auto_fix_delet_filters(sql2)
    assert "SF2.D_E_L_E_T_ <> '*'" in fixed2
    assert "SD2.D_E_L_E_T_ <> '*'" in fixed2
    assert "SF2.F2_FILIAL = '01'" in fixed2

    # 3. Query already having all filters is not duplicated
    sql3 = "SELECT A1_COD FROM SA1010 A1 WHERE A1.D_E_L_E_T_ <> '*'"
    fixed3 = auto_fix_delet_filters(sql3)
    assert fixed3 == sql3

    # 4. Query with GROUP BY and ORDER BY without WHERE
    sql4 = "SELECT A1_MUN, COUNT(*) FROM SA1010 A1 GROUP BY A1_MUN ORDER BY 2 DESC"
    fixed4 = auto_fix_delet_filters(sql4)
    assert "WHERE A1.D_E_L_E_T_ <> '*'" in fixed4
    assert fixed4.index("WHERE") < fixed4.index("GROUP BY")


