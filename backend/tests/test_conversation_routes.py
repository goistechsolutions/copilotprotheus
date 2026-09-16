import pytest
from app.services.conversation_service import ConversationTitleGenerator, ConversationContextEngine

def test_conversation_title_generator():
    t1 = ConversationTitleGenerator.generate("quais sao os titulos a receber vencidos em aberto da filial 01?")
    assert "Inadimplentes" in t1 or "Vencid" in t1 or "Receber" in t1

    t2 = ConversationTitleGenerator.generate("relatório de faturamento mensal por cliente nos últimos meses")
    assert "Faturamento" in t2

    t3 = ConversationTitleGenerator.generate("mostrar previsao de fluxo de caixa para 30 dias")
    assert t3 == "Fluxo de Caixa 30 Dias"

    t4 = ConversationTitleGenerator.generate("quais os top 10 clientes com maior receita")
    assert len(t4) > 0

    t5 = ConversationTitleGenerator.generate("pedidos de compra pendentes")
    assert "Pedidos de Compra" in t5

def test_conversation_context_engine():
    assert ConversationContextEngine.is_follow_up("e do cliente XYZ?") is True
    assert ConversationContextEngine.is_follow_up("e na filial 02?") is True
    assert ConversationContextEngine.is_follow_up("agora filtra por data de hoje") is True
    assert ConversationContextEngine.is_follow_up("mostre os títulos a pagar normais") is False

    prev = {
        "domain": "financeiro",
        "table": "SE1",
        "last_filters": {"filial": "01", "status": "vencido"},
        "history": [{"role": "user", "content": "titulos vencidos filial 01"}]
    }
    merged = ConversationContextEngine.merge_context(prev, "e do cliente 0001?")
    assert merged["domain"] == "financeiro"
    assert merged["is_follow_up"] is True
    assert "cliente 0001" in merged.get("follow_up_filter", "").lower()
