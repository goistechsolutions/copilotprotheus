import os
import sys
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.protheus_context_service import auto_fix_oracle_limit, validate_query_security
from app.db.database import resolve_clean_tenant
from app.core.rate_limit import check_tenant_rate_limit


def test_auto_fix_oracle_limit():
    """Valida a conversao automatica de SELECT TOP N e LIMIT para sintaxe Oracle."""
    sql_top = "SELECT TOP 10 A1_COD, A1_NOME FROM SA1010 WHERE D_E_L_E_T_ <> '*'"
    fixed_top = auto_fix_oracle_limit(sql_top)
    assert "TOP" not in fixed_top
    assert "FETCH FIRST 10 ROWS ONLY" in fixed_top
    # A query corrigida passa na validação de segurança do Oracle
    validate_query_security(sql=fixed_top, allowed_tables={"SA1010"}, filial="01")

    sql_limit = "SELECT A1_COD, A1_NOME FROM SA1010 WHERE D_E_L_E_T_ <> '*' LIMIT 5"
    fixed_limit = auto_fix_oracle_limit(sql_limit)
    assert "LIMIT" not in fixed_limit
    assert "FETCH FIRST 5 ROWS ONLY" in fixed_limit
    validate_query_security(sql=fixed_limit, allowed_tables={"SA1010"}, filial="01")

    sql_limit_offset = "SELECT A1_COD, A1_NOME FROM SA1010 WHERE D_E_L_E_T_ <> '*' LIMIT 20 OFFSET 40"
    fixed_lo = auto_fix_oracle_limit(sql_limit_offset)
    assert "LIMIT" not in fixed_lo
    assert "OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY" in fixed_lo
    validate_query_security(sql=fixed_lo, allowed_tables={"SA1010"}, filial="01")


def test_oracle_sql_prohibits_select_top():
    """Valida que consultas com SELECT TOP N são bloqueadas para o dialeto Oracle."""
    forbidden_sql = "SELECT TOP 10 A1_COD, A1_NOME FROM SA1010 WHERE D_E_L_E_T_ <> '*'"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql=forbidden_sql, allowed_tables={"SA1010"}, filial="01")
    assert exc_info.value.status_code == 400
    assert "SELECT TOP" in exc_info.value.detail


def test_oracle_sql_requires_delet_filter():
    """Valida que consultas sem o filtro de exclusão lógica D_E_L_E_T_ <> '*' são rejeitadas."""
    missing_delet_sql = "SELECT A1_COD, A1_NOME FROM SA1010 WHERE A1_FILIAL = '01'"
    with pytest.raises(HTTPException) as exc_info:
        validate_query_security(sql=missing_delet_sql, allowed_tables={"SA1010"}, filial="01")
    assert exc_info.value.status_code == 400
    assert "D_E_L_E_T_" in exc_info.value.detail


def test_oracle_sql_valid_query_passes():
    """Valida que consultas Oracle com ROWNUM e D_E_L_E_T_ <> '*' passam na segurança."""
    valid_sql = "SELECT A1_COD, A1_NOME FROM SA1010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10"
    # Não deve lançar exceção
    validate_query_security(sql=valid_sql, allowed_tables={"SA1010"}, filial="01")


def test_resolve_clean_tenant_converts_numeric_ids():
    """Valida que a resolução de tenant não permite a criação de schemas numéricos como '1'."""
    db_mock = MagicMock()
    # Simula busca no tenant_registry para id numérico '1'
    db_mock.execute.return_value.mappings.return_value.first.return_value = {
        "tenant_code": "rodol",
        "schema_name": "rodol"
    }
    
    clean = resolve_clean_tenant(db_mock, "1")
    assert clean == "rodol"
    assert clean != "1"


def test_rate_limiting_structure_and_enforcement():
    """Valida que o serviço de rate limit retorna o dicionário com a cota restante."""
    db_mock = MagicMock()
    db_mock.execute.return_value.mappings.return_value.first.return_value = {
        "tenant_code": "rodol",
        "schema_name": "rodol",
    }
    # Mock do plano (500 consultas/dia)
    db_mock.execute.return_value.fetchone.return_value = (500,)
    # Mock de 10 consultas realizadas hoje
    db_mock.execute.return_value.scalar.return_value = 10

    info = check_tenant_rate_limit(db_mock, "rodol")
    assert info["tenant"] == "rodol"
    assert info["queries_today"] == 10
    assert info["max_queries_day"] == 500
    assert info["remaining"] == 490
