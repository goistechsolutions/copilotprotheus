import os
import re

file_path = "backend/app/api/agent_sql_routes.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_func = """
def _build_semantic_result(rows: list[dict[str, Any]]) -> dict:
    columns = list(rows[0].keys()) if rows and isinstance(rows[0], dict) else []
    dimensions = []
    measures = []
    
    # Identify dimensions and measures
    for col in columns:
        name = str(col).upper()
        if re.search(r"(^|_)(ANO|MES|DATA|DATE|PERIODO|COD|CODIGO|ID|NUMERO|NR|FILIAL|EMPRESA|BRANCH|VENDEDOR|VEND|PRODUTO|ITEM|GRUPO)(_|$)", name) and not _is_non_metric_field(col):
            # It's a dimension
            kind = "time" if re.search(r"ANO|MES|DATA|DATE|PERIODO", name) else "string"
            dimensions.append({
                "key": col,
                "label": col,
                "kind": kind
            })
        else:
            # Check if it's a measure
            values = [_parse_summary_number(row.get(col)) for row in rows if isinstance(row, dict)]
            numeric_values = [v for v in values if v is not None]
            if numeric_values and re.search(r"VALOR|TOTAL|FATUR|RECEITA|SALDO|PRE[ÇC]O|MARGEM|QUANT|QTD|VOLUME", name):
                measures.append({
                    "key": col,
                    "label": col,
                    "format": "currency" if re.search(r"VALOR|FATUR|RECEITA|SALDO|PRE[ÇC]O", name) else "number",
                    "aggregation": "sum"
                })

    # Build KPIs
    kpis = []
    series = []
    
    if measures:
        primary_measure = measures[0]
        # Calculate KPI value
        total_val = sum((_parse_summary_number(row.get(primary_measure["key"])) or 0) for row in rows)
        
        kpi = {
            "key": f"total_{primary_measure['key'].lower()}",
            "label": primary_measure["label"],
            "value": total_val,
            "format": primary_measure["format"],
            "source_column": primary_measure["key"],
            "aggregation": primary_measure["aggregation"]
        }
        
        time_dim = next((d for d in dimensions if d["kind"] == "time"), None)
        if time_dim:
            kpi["dimension"] = time_dim["key"]
            
            # Build series
            points = []
            for row in rows:
                lbl = str(row.get(time_dim["key"], ""))
                val = _parse_summary_number(row.get(primary_measure["key"])) or 0
                points.append({"label": lbl, "value": val})
                
            series.append({
                "id": f"series_{primary_measure['key'].lower()}",
                "label": primary_measure["label"],
                "dimension": time_dim["key"],
                "measure": primary_measure["key"],
                "format": primary_measure["format"],
                "points": points
            })
            
        kpis.append(kpi)
        
    return {
        "columns": columns,
        "rows": rows,
        "metadata": {
            "row_count": len(rows),
            "source": "queryrest"
        },
        "dimensions": dimensions,
        "measures": measures,
        "kpis": kpis,
        "series": series
    }
"""

if "_build_semantic_result" not in content:
    content = content.replace("def _build_safe_result_summary", new_func + "\ndef _build_safe_result_summary")

old_result_block = """                    response["result"] = {
                        "columns": list(safe_rows[0].keys()) if safe_rows and isinstance(safe_rows[0], dict) else [],
                        "rows": safe_rows,
                        "metadata": {
                            "row_count": len(rows),
                            "source": "queryrest"
                        },
                        "kpis": [],
                        "series": []
                    }"""

new_result_block = """                    if safe_rows and isinstance(safe_rows[0], dict):
                        response["result"] = _build_semantic_result(safe_rows)
                    else:
                        response["result"] = {
                            "columns": [],
                            "rows": safe_rows,
                            "metadata": {"row_count": len(rows), "source": "queryrest"},
                            "dimensions": [], "measures": [], "kpis": [], "series": []
                        }"""

content = content.replace(old_result_block, new_result_block)

# Handle empty case
old_empty_block = """                    if len(rows) == 0:
                        response["message"] = "Consulta concluída sem registros."
                        response["result"] = {"columns": [], "rows": [], "metadata": {"row_count": 0, "source": "queryrest"}, "kpis": [], "series": []}"""

new_empty_block = """                    if len(rows) == 0:
                        response["message"] = "Consulta concluída sem registros."
                        response["result"] = {"columns": [], "rows": [], "metadata": {"row_count": 0, "source": "queryrest"}, "dimensions": [], "measures": [], "kpis": [], "series": []}"""

content = content.replace(old_empty_block, new_empty_block)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched backend")
