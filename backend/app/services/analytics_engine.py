from typing import Dict, Any, List, Optional
import math
import logging

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Exceção levantada quando as métricas violam regras de consistência matemática."""
    pass

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
            # Limpeza basica se vier formatado do Protheus como R$ 1.000,00
            s = str(val).replace('R$', '').replace('.', '').replace(',', '.').strip()
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod
    def calculate_metrics(data_items: List[Dict[str, Any]], schema: Dict[str, Any]) -> Dict[str, Any]:
        """Metric Engine: Processa métricas determinísticas baseadas no schema."""
        if not data_items:
            return {"total": 0.0, "average": 0.0, "max_value": 0.0, "count": 0, "concentration": 0.0, "top_items": []}

        # Tentar identificar qual coluna é a principal "measure" (valor numérico)
        measure_key = None
        for key in data_items[0].keys():
            upper_key = key.upper()
            if any(m in upper_key for m in schema["measures"]):
                measure_key = key
                break
        
        # Tentar identificar qual coluna é a principal "dimension" (categoria)
        dimension_key = None
        for key in data_items[0].keys():
            upper_key = key.upper()
            if any(d in upper_key for d in schema["dimensions"]):
                dimension_key = key
                break
        
        if not measure_key:
            # Se não achou measure clara, fallback para a primeira coluna numérica
            for key, val in data_items[0].items():
                if isinstance(val, (int, float)):
                    measure_key = key
                    break

        if not dimension_key:
            # Fallback para a primeira coluna string não-data
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

        # Agregação e totalização
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

        # Sort agregados para obter ranking e concentração
        sorted_dims = sorted(dim_aggregates.items(), key=lambda x: x[1], reverse=True)
        
        if sorted_dims and total > 0:
            top_dim_val = sorted_dims[0][1]
            metrics["concentration"] = round((top_dim_val / total) * 100, 2)
            
            # Top 3
            metrics["top_items"] = [
                {"name": k, "value": round(v, 2), "share_percent": round((v / total) * 100, 2)}
                for k, v in sorted_dims[:3]
            ]
            metrics["maior_ocorrencia_nome"] = sorted_dims[0][0]
            metrics["maior_ocorrencia_valor"] = round(top_dim_val, 2)
        
        return metrics

    @staticmethod
    def validate_metrics(metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Validation Engine: Assegura que as leis matemáticas fundamentais não foram violadas."""
        count = metrics.get("count", 0)
        if count == 0:
            return metrics
            
        total = metrics.get("total", 0.0)
        conc = metrics.get("concentration", 0.0)

        # Regra 1: Concentração não pode ser > 100%
        if conc > 100.0 or conc < 0.0:
            logger.error(f"Validation Error: Concentração impossível ({conc}%)")
            raise ValidationError(f"Métrica de concentração inválida: {conc}%")
            
        # Regra 3: Se o share do Top 1 bater com a concentracao
        top_items = metrics.get("top_items", [])
        if top_items and top_items[0]["share_percent"] > 100:
            raise ValidationError("Share percent do principal item excede 100%")

        return metrics

    @classmethod
    def process(cls, intent: str, protheus_data: Any) -> Dict[str, Any]:
        """Pipeline principal que orquestra a resolução, cálculo e validação."""
        if not protheus_data:
            return {}
            
        # Normalizar protheus_data para lista
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

        schema = cls._resolve_schema(intent)
        metrics = cls.calculate_metrics(data_items, schema)
        
        try:
            validated_metrics = cls.validate_metrics(metrics)
            return validated_metrics
        except ValidationError as e:
            # Em caso de erro de validação, retornamos as métricas base limpas com flag de erro,
            # impedindo que o LLM use números corrompidos.
            return {"error": str(e), "status": "INCONSISTENT_DATA"}
