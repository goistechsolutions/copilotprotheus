from typing import Dict, Any, List, Optional
import math
import logging
import re
from datetime import datetime, date

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Exceção levantada quando as métricas violam regras de consistência matemática."""
    pass

class ValidationRule:
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Optional[Dict[str, str]]:
        raise NotImplementedError

class MaxLessThanTotalRule(ValidationRule):
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Optional[Dict[str, str]]:
        total = metrics.get("total", 0.0)
        max_val = metrics.get("max_value", 0.0)
        # Apply only if total is positive (gross values). For net balances with negatives, this rule might be tricky,
        # but for absolute sums it holds.
        if total > 0 and max_val > total:
            return {"code": "MAX_GT_TOTAL", "message": f"Maior valor ({max_val}) superior ao total ({total})"}
        return None

class PercentageRule(ValidationRule):
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Optional[Dict[str, str]]:
        if metrics.get("concentration", 0.0) > 100.0:
            return {"code": "INVALID_PERCENTAGE", "message": "Concentração > 100%"}
        
        for item in metrics.get("top_items", []):
            if item.get("share_percent", 0.0) > 100.0:
                return {"code": "INVALID_PERCENTAGE", "message": f"Share do item {item.get('name')} excede 100%"}
        return None

class AverageRule(ValidationRule):
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Optional[Dict[str, str]]:
        total = metrics.get("total", 0.0)
        avg = metrics.get("average", 0.0)
        if total > 0 and avg > total:
            return {"code": "AVG_GT_TOTAL", "message": f"Média ({avg}) maior que o total ({total})"}
        return None

class RowCountRule(ValidationRule):
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Optional[Dict[str, str]]:
        if metrics.get("count", 0) < 0:
            return {"code": "NEGATIVE_COUNT", "message": "Quantidade de registros não pode ser negativa"}
        return None

class ValidationEngine:
    def __init__(self):
        self.rules = [
            MaxLessThanTotalRule(),
            PercentageRule(),
            AverageRule(),
            RowCountRule()
        ]
        
    def validate(self, metrics: Dict[str, Any], schema: Dict[str, Any], domain: str) -> Dict[str, Any]:
        """
        Valida as métricas calculadas. Retorna um Quality Score e status.
        """
        score = 100
        errors = []
        
        if metrics.get("count", 0) == 0:
            return {"quality_score": 100, "status": "approved", "errors": []}

        for rule in self.rules:
            error = rule.validate(metrics, schema, domain)
            if error:
                errors.append(error)
                if error["code"] in ["MAX_GT_TOTAL", "INVALID_PERCENTAGE"]:
                    score -= 50
                else:
                    score -= 20
                    
        result = {
            "quality_score": max(0, score),
            "status": "approved" if score >= 70 else "rejected",
            "errors": errors
        }
        return result

class AnalyticsEngine:
    """
    Motor analítico determinístico.
    Garante que todos os cálculos de negócio (totais, agregações, shares, rankings)
    sejam processados via código estrito e validados antes de serem exibidos ao usuário ou narrados pelo LLM.
    """
    
    @staticmethod
    def _resolve_schema(intent: str) -> Dict[str, Any]:
        """
        Retorna o dicionário de dimensões e medidas esperado para a intenção fornecida.
        Simula um Schema Analyzer / Domain Resolver.
        """
        schemas = {
            "fluxo de caixa": {
                "domain": "FINANCEIRO",
                "measures": ["VALOR", "SALDO"],
                "dimensions": ["TIPO", "DATA", "CLASSIFICACAO"]
            },
            # Fallback generico
            "default": {
                "domain": "UNKNOWN",
                "measures": ["VALOR", "TOTAL", "AMOUNT", "PRICE", "PRECO", "QTD", "QUANTIDADE"],
                "dimensions": ["TIPO", "STATUS", "CATEGORIA", "GRUPO", "DATA", "NAME", "NOME"]
            }
        }
        
        normalized_intent = intent.lower() if intent else ""
        if "caixa" in normalized_intent or "financeiro" in normalized_intent:
            return schemas["fluxo de caixa"]
        
        return schemas["default"]

    @staticmethod
    def _extract_numeric(val: Any) -> float:
        if val is None:
            return 0.0
        try:
            if isinstance(val, (int, float)):
                return float(val)
            s = str(val).replace('R$', '').replace('.', '').replace(',', '.').strip()
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod
    def calculate_metrics(data_items: List[Dict[str, Any]], schema: Dict[str, Any]) -> Dict[str, Any]:
        """Layer 4: Recalcular KPIs deterministicamente das linhas cruas."""
        if not data_items:
            return {"total": 0.0, "average": 0.0, "max_value": 0.0, "count": 0, "concentration": 0.0, "top_items": []}

        measure_key = None
        for key in data_items[0].keys():
            upper_key = key.upper()
            if any(m in upper_key for m in schema["measures"]):
                measure_key = key
                break
        
        dimension_key = None
        # Prioritizar colunas de nome/descrição sobre códigos/IDs para rótulos em gráficos e top_items
        name_keys = [
            k for k in data_items[0].keys() 
            if any(p in k.upper() for p in ["NOME", "NOM", "DESC", "DESCRICAO", "RAZAO", "VENDEDOR", "CLIENTE", "FORNECEDOR", "PRODUTO"])
            and not any(p in k.upper() for p in ["COD", "CODIGO", "ID"])
        ]
        if name_keys:
            dimension_key = name_keys[0]
        else:
            for key in data_items[0].keys():
                upper_key = key.upper()
                if any(d in upper_key for d in schema["dimensions"]):
                    dimension_key = key
                    break
        
        if not measure_key:
            for key, val in data_items[0].items():
                if isinstance(val, (int, float)):
                    measure_key = key
                    break

        if not dimension_key:
            for key, val in data_items[0].items():
                if isinstance(val, str) and not ("DATE" in key.upper() or "DATA" in key.upper()):
                    dimension_key = key
                    break

        metrics = {
            "count": len(data_items),
            "total": 0.0,
            "max_value": 0.0,
            "average": 0.0,
            "concentration": 0.0,
            "top_items": []
        }

        if not measure_key:
            return metrics

        dim_aggregates = {}
        total = 0.0
        max_val = -math.inf

        for item in data_items:
            val = AnalyticsEngine._extract_numeric(item.get(measure_key, 0))
            dim = str(item.get(dimension_key, "N/A")) if dimension_key else "N/A"
            
            total += val
            if val > max_val:
                max_val = val
                
            if dim not in dim_aggregates:
                dim_aggregates[dim] = 0.0
            dim_aggregates[dim] += val

        metrics["total"] = round(total, 2)
        metrics["max_value"] = round(max_val, 2) if max_val != -math.inf else 0.0
        metrics["average"] = round(total / metrics["count"], 2) if metrics["count"] > 0 else 0.0

        sorted_dims = sorted(dim_aggregates.items(), key=lambda x: abs(x[1]), reverse=True)
        
        # Gross absolute total (soma dos MODULOS de cada grupo), nunca o saldo liquido.
        # Ex: RECEITA=15M, DESPESA=-14.4M → abs_total = 29.4M, nao 614k
        # Isso garante que share < 100% mesmo em dados financeiros com entradas negativas.
        abs_total = sum(abs(v) for v in dim_aggregates.values())
        
        if sorted_dims and abs_total > 0:
            top_dim_val = sorted_dims[0][1]
            metrics["concentration"] = round((abs(top_dim_val) / abs_total) * 100, 2)
            
            metrics["top_items"] = [
                {"name": k, "value": round(v, 2), "share_percent": round((abs(v) / abs_total) * 100, 2)}
                for k, v in sorted_dims[:3]
            ]
            metrics["maior_ocorrencia_nome"] = sorted_dims[0][0]
            metrics["maior_ocorrencia_valor"] = round(top_dim_val, 2)

        # Novos cálculos estendidos para Analytics 2.0
        metrics["distinct_entities"] = len(dim_aggregates)

        all_top = [
            {"name": k, "value": round(v, 2), "share_percent": round((abs(v) / abs_total) * 100, 2)}
            for k, v in sorted_dims[:10]
        ] if abs_total > 0 else []
        metrics["top5_share"] = round(sum(i["share_percent"] for i in all_top[:5]), 2)
        metrics["top10_share"] = round(sum(i["share_percent"] for i in all_top[:10]), 2)

        # Curva ABC (Classificação de representatividade financeira: A <= 80%, B <= 95%, C > 95%)
        cum_share = 0.0
        a_items, b_items, c_items = [], [], []
        for k, v in sorted_dims:
            share = (abs(v) / abs_total) * 100.0 if abs_total > 0 else 0.0
            cum_share += share
            if cum_share <= 80.0 or not a_items:
                a_items.append(k)
            elif cum_share <= 95.0 or not b_items:
                b_items.append(k)
            else:
                c_items.append(k)

        metrics["abc_curve"] = {
            "A": a_items,
            "B": b_items,
            "C": c_items,
            "a_count": len(a_items),
            "b_count": len(b_items),
            "c_count": len(c_items),
        }

        # Detecção de Outliers (z-score > 2.0)
        outliers = []
        if len(dim_aggregates) >= 3:
            vals = [abs(v) for v in dim_aggregates.values()]
            mean_val = sum(vals) / len(vals)
            variance = sum((x - mean_val) ** 2 for x in vals) / len(vals)
            std_dev = math.sqrt(variance)
            if std_dev > 0:
                for k, v in sorted_dims:
                    z = (abs(v) - mean_val) / std_dev
                    if z > 2.0:
                        outliers.append({
                            "name": k,
                            "value": round(v, 2),
                            "z_score": round(z, 2),
                            "ratio_to_mean": round(abs(v) / mean_val, 1) if mean_val > 0 else 1.0,
                        })
        metrics["outliers"] = outliers

        # Tendência temporal
        date_key = None
        for key in data_items[0].keys():
            ukey = key.upper()
            if any(p in ukey for p in ["DATA", "DATE", "MES", "ANO", "EMISSAO", "PERIODO", "VENCTO"]):
                date_key = key
                break

        trend = None
        if date_key:
            date_aggs = {}
            for item in data_items:
                d_raw = str(item.get(date_key, "")).strip()
                if not d_raw:
                    continue
                v_num = AnalyticsEngine._extract_numeric(item.get(measure_key, 0))
                date_aggs[d_raw] = date_aggs.get(d_raw, 0.0) + v_num

            if len(date_aggs) >= 2:
                sorted_dates = sorted(date_aggs.items(), key=lambda x: str(x[0]))
                first_d, first_v = sorted_dates[0]
                last_d, last_v = sorted_dates[-1]
                growth_pct = round(((last_v - first_v) / abs(first_v)) * 100, 2) if first_v != 0 else 0.0
                direction = "crescimento" if growth_pct > 2.0 else ("queda" if growth_pct < -2.0 else "estavel")

                best_p = max(sorted_dates, key=lambda x: x[1])
                trend = {
                    "direction": direction,
                    "growth_pct": growth_pct,
                    "periods_count": len(sorted_dates),
                    "best_period": {
                        "label": best_p[0],
                        "value": round(best_p[1], 2),
                        "share_pct": round((best_p[1] / total) * 100, 2) if total > 0 else 0.0,
                    }
                }
        metrics["trend"] = trend

        # Análise de Aging (para inadimplência / vencimento)
        venc_key = None
        for key in data_items[0].keys():
            ukey = key.upper()
            if any(p in ukey for p in ["VENCTO", "VENCIMENTO", "DATA_VENC", "E1_VENCTO"]):
                venc_key = key
                break

        aging = None
        if venc_key:
            buckets = {
                "0_15": {"count": 0, "total": 0.0, "pct": 0.0},
                "16_30": {"count": 0, "total": 0.0, "pct": 0.0},
                "31_60": {"count": 0, "total": 0.0, "pct": 0.0},
                "61_90": {"count": 0, "total": 0.0, "pct": 0.0},
                "90_plus": {"count": 0, "total": 0.0, "pct": 0.0},
            }
            today = date.today()
            total_aging = 0.0

            for item in data_items:
                raw_dt = str(item.get(venc_key, "")).strip()
                val_dt = AnalyticsEngine._extract_numeric(item.get(measure_key, 0))
                parsed_date = None

                if len(raw_dt) == 8 and raw_dt.isdigit():
                    try:
                        parsed_date = datetime.strptime(raw_dt, "%Y%m%d").date()
                    except ValueError:
                        pass
                elif "-" in raw_dt:
                    try:
                        parsed_date = datetime.strptime(raw_dt[:10], "%Y-%m-%d").date()
                    except ValueError:
                        pass
                elif "/" in raw_dt:
                    try:
                        parsed_date = datetime.strptime(raw_dt[:10], "%d/%m/%Y").date()
                    except ValueError:
                        pass

                if parsed_date:
                    days_overdue = (today - parsed_date).days
                    if days_overdue > 0:
                        total_aging += val_dt
                        if days_overdue <= 15:
                            b_key = "0_15"
                        elif days_overdue <= 30:
                            b_key = "16_30"
                        elif days_overdue <= 60:
                            b_key = "31_60"
                        elif days_overdue <= 90:
                            b_key = "61_90"
                        else:
                            b_key = "90_plus"

                        buckets[b_key]["count"] += 1
                        buckets[b_key]["total"] += val_dt

            if total_aging > 0:
                for b_key, b_info in buckets.items():
                    b_info["total"] = round(b_info["total"], 2)
                    b_info["pct"] = round((b_info["total"] / total_aging) * 100, 2)

                above_60 = buckets["61_90"]["total"] + buckets["90_plus"]["total"]
                pct_above_60 = round((above_60 / total_aging) * 100, 2)
                risk = "alto" if pct_above_60 > 40.0 else ("medio" if pct_above_60 > 20.0 else "baixo")

                aging = {
                    **buckets,
                    "total_overdue": round(total_aging, 2),
                    "pct_above_60": pct_above_60,
                    "risk": risk,
                }
        metrics["aging"] = aging

        return metrics

    @classmethod
    def process(cls, intent: str, protheus_data: Any) -> Dict[str, Any]:
        """Pipeline principal que orquestra a resolução, cálculo e validação."""
        if not protheus_data:
            return {}
            
        data_items = []
        if isinstance(protheus_data, dict):
            if "items" in protheus_data and isinstance(protheus_data["items"], list):
                data_items = protheus_data["items"]
            else:
                for v in protheus_data.values():
                    if isinstance(v, list):
                        data_items.extend(v)
        elif isinstance(protheus_data, list):
            data_items = protheus_data

        if not data_items:
            return {}

        # Log 1: Domain resolution
        schema = cls._resolve_schema(intent)
        logger.info({
            "stage": "domain_resolved",
            "intent": intent,
            "domain": schema["domain"],
            "row_count": len(data_items),
        })

        metrics = cls.calculate_metrics(data_items, schema)

        # Log 2: Metric calculation result
        logger.info({
            "stage": "metrics_calculated",
            "domain": schema["domain"],
            "total": metrics.get("total"),
            "max_value": metrics.get("max_value"),
            "average": metrics.get("average"),
            "concentration": metrics.get("concentration"),
            "top_dimension": metrics.get("maior_ocorrencia_nome"),
        })
        
        validator = ValidationEngine()
        validation_result = validator.validate(metrics, schema, schema["domain"])

        # Log 3: Validation outcome
        logger.info({
            "stage": "validation_complete",
            "domain": schema["domain"],
            "quality_score": validation_result.get("quality_score"),
            "status": validation_result.get("status"),
            "errors": validation_result.get("errors", []),
        })
        
        if validation_result["status"] == "rejected":
            logger.error({
                "stage": "pipeline_rejected",
                "domain": schema["domain"],
                "errors": validation_result["errors"],
            })
            raise ValidationError(f"Métricas inconsistentes: {validation_result['errors']}")
            
        metrics["quality"] = validation_result
        return metrics

