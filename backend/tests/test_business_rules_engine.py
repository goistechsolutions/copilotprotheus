import pytest
from app.services.business_rules_engine import BusinessRulesEngine

def test_apply_synonyms_mock():
    class DummyRow:
        def __init__(self, s, t):
            self.source_term = s
            self.target_term = t
        def __iter__(self):
            return iter([self.source_term, self.target_term])

    class DummyResult:
        def fetchall(self):
            return [("Receitas", "Faturamento"), ("Comprador", "Cliente"), ("Representante", "Vendedor")]

    class DummyDB:
        def execute(self, q, params):
            return DummyResult()

    db = DummyDB()
    p1 = BusinessRulesEngine.apply_synonyms("qual o total de receitas do comprador João?", "tenant1", db)
    assert p1 == "qual o total de Faturamento do Cliente João?"

    p2 = BusinessRulesEngine.apply_synonyms("mostrar vendas por representante", "tenant1", db)
    assert p2 == "mostrar vendas por Vendedor"

def test_build_rules_instruction_tes_sales_and_bonus():
    # Tenant A: TES 501 = Venda, TES 502 = Bonificação
    rules_tenant_a = {
        "tes_sales": ["501"],
        "tes_bonus": ["502"],
        "tes_devolution": [],
        "module_config": {"receivables_overdue_days": 30}
    }
    instruction_a = BusinessRulesEngine.build_rules_instruction(rules_tenant_a, "qual meu faturamento?", "sales")
    assert "D2_TES IN ('501')" in instruction_a
    assert "D2_TES NOT IN ('502')" in instruction_a

    # Perguntando por bonificação:
    bon_instruction = BusinessRulesEngine.build_rules_instruction(rules_tenant_a, "quanto perdi com bonificações?", "sales")
    assert "D2_TES IN ('502')" in bon_instruction

    # Tenant B: TES 502 = Venda, TES 501 = Bonificação
    rules_tenant_b = {
        "tes_sales": ["502"],
        "tes_bonus": ["501"],
        "tes_devolution": [],
        "module_config": {}
    }
    instruction_b = BusinessRulesEngine.build_rules_instruction(rules_tenant_b, "qual meu faturamento?", "sales")
    assert "D2_TES IN ('502')" in instruction_b
    assert "D2_TES NOT IN ('501')" in instruction_b

def test_build_rules_instruction_receivables_and_stock():
    rules = {
        "tes_sales": [],
        "tes_bonus": [],
        "module_config": {
            "receivables_overdue_days": 45,
            "receivables_include_renegotiated": False,
            "stock_idle_days": 60,
            "stock_critical_days": 5
        }
    }
    inst_fin = BusinessRulesEngine.build_rules_instruction(rules, "titulos a receber em atraso", "finance")
    assert "45 dias de atraso" in inst_fin
    assert "NÃO considerar títulos renegociados" in inst_fin

    inst_stk = BusinessRulesEngine.build_rules_instruction(rules, "produtos sem giro em estoque", "stock")
    assert "60 dias sem movimentação" in inst_stk
    assert "5 dias" in inst_stk
