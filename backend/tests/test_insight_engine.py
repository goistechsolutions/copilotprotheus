import pytest
from app.services.analytics_engine import AnalyticsEngine
from app.services.insight_rules import InsightEngine

def test_analytics_engine_extended_metrics():
    # Dataset simulado com 5 clientes
    rows = [
        {"CLIENTE": "CLIENTE A", "VALOR": 10000.00, "DATA": "20260101"},
        {"CLIENTE": "CLIENTE B", "VALOR": 5000.00, "DATA": "20260201"},
        {"CLIENTE": "CLIENTE C", "VALOR": 2500.00, "DATA": "20260301"},
        {"CLIENTE": "CLIENTE D", "VALOR": 1500.00, "DATA": "20260401"},
        {"CLIENTE": "CLIENTE E", "VALOR": 1000.00, "DATA": "20260501"},
    ]
    schema = AnalyticsEngine._resolve_schema("vendas")
    metrics = AnalyticsEngine.calculate_metrics(rows, schema)

    assert metrics["count"] == 5
    assert metrics["total"] == 20000.00
    assert metrics["distinct_entities"] == 5
    assert metrics["top5_share"] == 100.0
    assert "abc_curve" in metrics
    assert "A" in metrics["abc_curve"]
    assert "B" in metrics["abc_curve"]
    assert "C" in metrics["abc_curve"]
    assert metrics["abc_curve"]["a_count"] >= 1
    assert metrics["trend"] is not None

def test_insight_engine_evaluation():
    # Simula métricas com alta concentração
    metrics = {
        "count": 10,
        "total": 100000.0,
        "distinct_entities": 10,
        "concentration": 55.0,  # > 40% -> High concentration
        "maior_ocorrencia_nome": "MEGA CLIENTE",
        "top_items": [
            {"name": "MEGA CLIENTE", "value": 55000.0, "share_percent": 55.0},
            {"name": "CLIENTE B", "value": 15000.0, "share_percent": 15.0},
            {"name": "CLIENTE C", "value": 10000.0, "share_percent": 10.0},
        ],
        "aging": {
            "pct_above_60": 45.0,  # > 40% -> Critical aging
            "risk": "alto"
        },
        "outliers": [
            {"name": "MEGA CLIENTE", "value": 55000.0, "ratio_to_mean": 5.5}
        ]
    }

    insights = InsightEngine.evaluate(metrics)
    assert len(insights) >= 2
    codes = [i["code"] for i in insights]
    assert "AGING_RISK_HIGH" in codes
    assert "CONCENTRATION_HIGH" in codes

    # O insight de maior score (AGING_RISK_HIGH score=95) deve vir primeiro
    assert insights[0]["code"] == "AGING_RISK_HIGH"
    assert insights[0]["severity"] == "CRITICAL"
