import pytest
from app.api.agent_sql_routes import _build_semantic_result, _build_safe_result_summary

def test_semantic_result_contract_success():
    rows = [
        {"PERIODO_MES": "202601", "VALOR_TOTAL_FATURADO": 1784869.65},
        {"PERIODO_MES": "202602", "VALOR_TOTAL_FATURADO": 2000000.00}
    ]
    
    result = _build_semantic_result(rows)
    
    assert "columns" in result
    assert "rows" in result
    assert "metadata" in result
    assert "dimensions" in result
    assert "measures" in result
    assert "kpis" in result
    assert "series" in result
    
    assert result["metadata"]["row_count"] == 2
    assert result["metadata"]["source"] == "queryrest"
    
    # Check dimension inference
    assert len(result["dimensions"]) == 1
    assert result["dimensions"][0]["key"] == "PERIODO_MES"
    assert result["dimensions"][0]["kind"] == "time"
    
    # Check measure inference
    assert len(result["measures"]) == 1
    assert result["measures"][0]["key"] == "VALOR_TOTAL_FATURADO"
    assert result["measures"][0]["format"] == "currency"
    
    # Check kpi creation
    assert len(result["kpis"]) == 1
    assert result["kpis"][0]["value"] == 3784869.65
    assert result["kpis"][0]["dimension"] == "PERIODO_MES"
    
    # Check series creation
    assert len(result["series"]) == 1
    assert len(result["series"][0]["points"]) == 2
    assert result["series"][0]["points"][0]["label"] == "202601"
    assert result["series"][0]["points"][0]["value"] == 1784869.65

def test_semantic_result_contract_empty():
    rows = []
    
    # The empty handling is done at the route level in process_agent_task,
    # but let's test how _build_semantic_result handles empty (should not be called directly,
    result = _build_semantic_result(rows)
    assert result["columns"] == []
    assert result["rows"] == []
    assert result["dimensions"] == []
    assert result["measures"] == []
