from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class InsightRule:
    """Regra de negócio para geração determinística de conclusões e alertas executivos."""
    code: str = "GENERIC_RULE"
    priority: int = 5  # 1 (mais urgente) a 5 (informativo)
    domain: Optional[str] = None  # None = aplicável a todos os domínios

    def condition(self, metrics: Dict[str, Any]) -> bool:
        raise NotImplementedError

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError


class ConcentrationHighRule(InsightRule):
    code = "CONCENTRATION_HIGH"
    priority = 2

    def condition(self, metrics: Dict[str, Any]) -> bool:
        return metrics.get("concentration", 0.0) > 40.0 and metrics.get("count", 0) > 1

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        top_name = metrics.get("maior_ocorrencia_nome", "Líder")
        top_share = metrics.get("concentration", 0.0)
        return {
            "code": self.code,
            "title": "Alta Concentração",
            "description": f"O principal elemento ({top_name}) concentra {top_share:.1f}% do total, indicando risco de dependência.",
            "value": f"{top_share:.1f}%",
            "severity": "WARNING",
            "score": 80,
        }


class ConcentrationLowRule(InsightRule):
    code = "CONCENTRATION_LOW"
    priority = 4

    def condition(self, metrics: Dict[str, Any]) -> bool:
        distinct = metrics.get("distinct_entities", metrics.get("count", 0))
        return metrics.get("concentration", 0.0) < 20.0 and distinct >= 4

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        top_share = metrics.get("concentration", 0.0)
        return {
            "code": self.code,
            "title": "Carteira Pulverizada",
            "description": f"Nenhum elemento concentra mais de {top_share:.1f}% do total analisado, demonstrando boa distribuição e baixo risco.",
            "value": f"{top_share:.1f}%",
            "severity": "SUCCESS",
            "score": 60,
        }


class AgingRiskHighRule(InsightRule):
    code = "AGING_RISK_HIGH"
    priority = 1

    def condition(self, metrics: Dict[str, Any]) -> bool:
        aging = metrics.get("aging")
        return bool(aging and aging.get("pct_above_60", 0.0) > 40.0)

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        pct = metrics["aging"]["pct_above_60"]
        return {
            "code": self.code,
            "title": "Risco de Inadimplência Elevado",
            "description": f"{pct:.1f}% dos títulos em atraso possuem mais de 60 dias de vencimento, exigindo ação de cobrança imediata.",
            "value": f"{pct:.1f}% críticos",
            "severity": "CRITICAL",
            "score": 95,
        }


class AgingRiskMediumRule(InsightRule):
    code = "AGING_RISK_MEDIUM"
    priority = 3

    def condition(self, metrics: Dict[str, Any]) -> bool:
        aging = metrics.get("aging")
        if not aging:
            return False
        pct = aging.get("pct_above_60", 0.0)
        return 20.0 < pct <= 40.0

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        pct = metrics["aging"]["pct_above_60"]
        return {
            "code": self.code,
            "title": "Inadimplência em Atenção",
            "description": f"{pct:.1f}% dos títulos possuem atraso superior a 60 dias, recomendando monitoramento ativo.",
            "value": f"{pct:.1f}%",
            "severity": "WARNING",
            "score": 75,
        }


class OutlierRule(InsightRule):
    code = "OUTLIER_DETECTED"
    priority = 2

    def condition(self, metrics: Dict[str, Any]) -> bool:
        outliers = metrics.get("outliers") or []
        return len(outliers) > 0

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        outlier = metrics["outliers"][0]
        name = outlier.get("name", "Registro")
        ratio = outlier.get("ratio_to_mean", 0.0)
        desc = f"Identificado {name} com valor {ratio}x superior à média da amostra." if ratio > 1 else f"Identificado {name} com valor atípico em relação ao padrão."
        return {
            "code": self.code,
            "title": "Elemento Atípico Detectado",
            "description": desc,
            "value": str(outlier.get("value", "")),
            "severity": "WARNING",
            "score": 70,
        }


class GrowthPositiveRule(InsightRule):
    code = "GROWTH_POSITIVE"
    priority = 3

    def condition(self, metrics: Dict[str, Any]) -> bool:
        trend = metrics.get("trend")
        return bool(trend and trend.get("direction") == "crescimento" and trend.get("growth_pct", 0.0) >= 5.0)

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        growth = metrics["trend"]["growth_pct"]
        return {
            "code": self.code,
            "title": "Tendência de Crescimento",
            "description": f"O período analisado apresenta avanço de {growth:.1f}% em comparação ao início da série.",
            "value": f"+{growth:.1f}%",
            "severity": "SUCCESS",
            "score": 65,
        }


class GrowthNegativeRule(InsightRule):
    code = "GROWTH_NEGATIVE"
    priority = 3

    def condition(self, metrics: Dict[str, Any]) -> bool:
        trend = metrics.get("trend")
        return bool(trend and trend.get("direction") == "queda" and abs(trend.get("growth_pct", 0.0)) >= 5.0)

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        growth = metrics["trend"]["growth_pct"]
        return {
            "code": self.code,
            "title": "Tendência de Queda",
            "description": f"Foi observada retração de {abs(growth):.1f}% no período analisado.",
            "value": f"{growth:.1f}%",
            "severity": "WARNING",
            "score": 65,
        }


class ABCSkewRule(InsightRule):
    code = "ABC_HIGH_SKEW"
    priority = 3

    def condition(self, metrics: Dict[str, Any]) -> bool:
        abc = metrics.get("abc_curve")
        distinct = metrics.get("distinct_entities", 0)
        if not abc or distinct < 5:
            return False
        a_count = abc.get("a_count", 0)
        return (a_count / distinct) <= 0.15 and a_count > 0

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        a_count = metrics["abc_curve"]["a_count"]
        return {
            "code": self.code,
            "title": "Curva ABC Estreita",
            "description": f"Apenas {a_count} elemento(s) acumulam 80% de todo o valor financeiro (Curva A restrita).",
            "value": f"{a_count} líderes",
            "severity": "WARNING",
            "score": 65,
        }


class Top3ConcentrationRule(InsightRule):
    code = "TOP3_CONCENTRATION"
    priority = 4

    def condition(self, metrics: Dict[str, Any]) -> bool:
        top_items = metrics.get("top_items", [])
        if len(top_items) < 3:
            return False
        top3_sum = sum(i.get("share_percent", 0.0) for i in top_items[:3])
        return top3_sum >= 50.0

    def build(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        top_items = metrics.get("top_items", [])
        top3_sum = sum(i.get("share_percent", 0.0) for i in top_items[:3])
        return {
            "code": self.code,
            "title": "Concentração nos Top 3",
            "description": f"Os 3 principais elementos respondem juntos por {top3_sum:.1f}% de toda a movimentação.",
            "value": f"{top3_sum:.1f}%",
            "severity": "INFO",
            "score": 55,
        }


class InsightEngine:
    """Motor central de inferência de insights executivos."""
    _rules: List[InsightRule] = [
        AgingRiskHighRule(),
        ConcentrationHighRule(),
        AgingRiskMediumRule(),
        OutlierRule(),
        GrowthPositiveRule(),
        GrowthNegativeRule(),
        ABCSkewRule(),
        ConcentrationLowRule(),
        Top3ConcentrationRule(),
    ]

    @classmethod
    def evaluate(cls, metrics: Dict[str, Any], domain: Optional[str] = None) -> List[Dict[str, Any]]:
        if not metrics or metrics.get("count", 0) == 0:
            return []

        insights: List[Dict[str, Any]] = []
        for rule in cls._rules:
            if rule.domain and domain and rule.domain.upper() != domain.upper():
                continue
            try:
                if rule.condition(metrics):
                    insight_data = rule.build(metrics)
                    insights.append(insight_data)
            except Exception as exc:
                logger.warning("Falha ao avaliar regra de insight %s: %s", getattr(rule, "code", "UNKNOWN"), exc)

        # Ordenar por score decrescente e retornar os mais relevantes
        insights.sort(key=lambda x: x.get("score", 0), reverse=True)
        return insights[:5]
