import re
from typing import Any, List, Dict

def _parse_summary_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(".", "").replace(",", "."))
        except ValueError:
            return None
    return None

def extract_dimensions_and_measures(columns: List[str], rows: List[Dict[str, Any]]):
    dimensions = []
    measures = []
    
    for col in columns:
        name = str(col).upper()
        if re.search(r"(^|_)(ANO|MES|DATA|DATE|PERIODO|COD|CODIGO|ID|NUMERO|NR|FILIAL|EMPRESA|BRANCH|VENDEDOR|VEND|PRODUTO|ITEM|GRUPO)(_|$)", name):
            kind = "time" if re.search(r"ANO|MES|DATA|DATE|PERIODO", name) else "string"
            dimensions.append({
                "key": col,
                "label": col,
                "kind": kind
            })
        else:
            values = [_parse_summary_number(row.get(col)) for row in rows if isinstance(row, dict)]
            numeric_values = [v for v in values if v is not None]
            if numeric_values and re.search(r"VALOR|TOTAL|FATUR|RECEITA|SALDO|PRECO|MARGEM|QUANT|QTD|VOLUME", name):
                measures.append({
                    "key": col,
                    "label": col,
                    "format": "currency" if re.search(r"VALOR|FATUR|RECEITA|SALDO|PRECO", name) else "number",
                    "aggregation": "sum"
                })
    return dimensions, measures
