from typing import Dict, Any, List, Optional
import math
import logging

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

