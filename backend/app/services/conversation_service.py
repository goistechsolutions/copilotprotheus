"""
backend/app/services/conversation_service.py

Serviço do Copilot Protheus Chat 2.0:
- ConversationTitleGenerator: Geração automática e executiva de títulos de conversas.
- ConversationContextEngine: Manutenção do estado e contexto contínuo para perguntas de follow-up.
"""

import re
from typing import Dict, Any, Optional

class ConversationTitleGenerator:
    """
    Gera títulos executivos claros e concisos a partir da primeira pergunta do usuaário,
    seguindo as diretrizes da especificação Copilot Chat 2.0.
    """

    PATTERNS = [
        (r"(?i)fluxo\s+de\s+caixa.*?(\d+)\s*dias?", lambda m: f"Fluxo de Caixa {m.group(1)} Dias"),
        (r"(?i)fluxo\s+de\s+caixa", lambda m: "Fluxo de Caixa"),
        (r"(?i)t[ií]tulos?\s+(?:a\s+)?receber\s+(?:em\s+atraso|vencid\w*)", lambda m: "Títulos a Receber Vencidos"),
        (r"(?i)t[ií]tulos?\s+(?:a\s+)?pagar\s+(?:em\s+atraso|vencid\w*)", lambda m: "Títulos a Pagar Vencidos"),
        (r"(?i)(?:clientes?|t[ií]tulos?)\s+.*?(?:em\s+atraso|vencid\w*|inadimpl\w*)", lambda m: "Títulos Vencidos"),
        (r"(?i)inadimpl[eê]ncia", lambda m: "Inadimplência Corporativa"),
        (r"(?i)(?:contas?|t[ií]tulos?)\s+a\s+receber", lambda m: "Contas a Receber"),
        (r"(?i)(?:contas?|t[ií]tulos?)\s+a\s+pagar", lambda m: "Contas a Pagar"),
        (r"(?i)ranking\s+(?:de\s+)?clientes?", lambda m: "Ranking de Clientes"),
        (r"(?i)ranking\s+(?:de\s+)?vendedores?", lambda m: "Ranking de Vendedores"),
        (r"(?i)vendas?\s+(?:do\s+m[eê]s|mensal|por\s+vendedor)", lambda m: "Vendas por Vendedor"),
        (r"(?i)faturamento\s+(?:do\s+m[eê]s|mensal)", lambda m: "Faturamento Mensal"),
        (r"(?i)produtos?\s+(?:sem\s+giro|parados?)", lambda m: "Estoque Sem Giro"),
        (r"(?i)estoque\s+cr[ií]tico", lambda m: "Estoque Crítico"),
        (r"(?i)cobertura\s+de\s+estoque", lambda m: "Cobertura de Estoque"),
        (r"(?i)pedidos?\s+de\s+compras?", lambda m: "Pedidos de Compra"),
        (r"(?i)pedidos?\s+de\s+vendas?", lambda m: "Pedidos de Venda"),
    ]

    @classmethod
    def generate_title(cls, prompt: str) -> str:
        clean_prompt = (prompt or "").strip()
        if not clean_prompt:
            return "Nova Conversa"

        for pattern, formatter in cls.PATTERNS:
            match = re.search(pattern, clean_prompt)
            if match:
                return formatter(match)

        words = clean_prompt.split()
        if len(words) <= 5:
            title = clean_prompt
        else:
            title = " ".join(words[:5])

        title = re.sub(r"[?!.,;]+$", "", title).strip()
        return title[:50].strip().title()

    @classmethod
    def generate(cls, prompt: str) -> str:
        """Alias para generate_title para conveniência."""
        return cls.generate_title(prompt)


class ConversationContextEngine:
    """
    Mantém o estado contextual ativo de cada conversa (Section 12 & 13 do Chat 2.0).
    Permite perguntas subsequentes como 'Compare com mês anterior' saberem
    o domínio, dataset e métrica da consulta anterior.
    """

    FOLLOW_UP_TRIGGERS = [
        r"(?i)^e\s+(?:do|da|no|na|em|os|as|para|com)\b",
        r"(?i)compare\s+com",
        r"(?i)e\s+no\s+m[eê]s\s+anterior",
        r"(?i)e\s+na\s+semana\s+passada",
        r"(?i)quem\s+s[aã]o\s+os\s+(?:maiores|top)",
        r"(?i)detalhar",
        r"(?i)filtrar?\s+por",
        r"(?i)agora\s+filtr\w*",
        r"(?i)e\s+os\s+a\s+pagar",
        r"(?i)e\s+os\s+a\s+receber",
    ]

    @classmethod
    def is_follow_up(cls, prompt: str) -> bool:
        clean = (prompt or "").strip()
        return any(re.search(pattern, clean) for pattern in cls.FOLLOW_UP_TRIGGERS)

    @classmethod
    def merge_context(cls, current_context: Dict[str, Any], new_prompt: str) -> Dict[str, Any]:
        resolved = dict(current_context or {})
        clean = (new_prompt or "").strip()

        if cls.is_follow_up(clean):
            resolved["is_follow_up"] = True
            resolved["parent_query"] = resolved.get("last_query")
            resolved["inherited_domain"] = resolved.get("domain")
            resolved["inherited_dataset_type"] = resolved.get("dataset_type")
            resolved["follow_up_filter"] = clean
        else:
            resolved["is_follow_up"] = False

        resolved["last_query"] = clean
        return resolved
