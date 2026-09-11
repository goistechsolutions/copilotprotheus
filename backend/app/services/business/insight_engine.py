from typing import Any, List, Dict

def generate_insights(measures: List[Dict[str, Any]], rows: List[Dict[str, Any]], total_val: float) -> List[Dict[str, str]]:
    if not measures:
        return []
    
    primary_measure = measures[0]
    
    fmt_total = f"R$ {total_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if primary_measure["format"] == "currency" else f"{total_val:,.2f}"
    fmt_avg = f"R$ {(total_val / len(rows) if rows else 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if primary_measure["format"] == "currency" else f"{(total_val / len(rows) if rows else 0):,.2f}"
    
    insights = [
        {
            "title": "Analise de Volume",
            "description": f"A consulta encontrou {len(rows)} registros na base do Protheus.",
            "value": f"{len(rows)} documentos",
            "type": "info"
        },
        {
            "title": "Consolidacao Numerica",
            "description": f"O total agregado nas colunas de metrica foi de {fmt_total}. O valor medio por registro e de {fmt_avg}.",
            "value": fmt_total,
            "type": "opportunity" if total_val > 0 else "info"
        },
        {
            "title": "Validacao de Tendencia",
            "description": "Nao foram identificadas comparacoes historicas suficientes nas colunas retornadas para prever tendencias.",
            "value": "Analise Restrita",
            "type": "info"
        }
    ]
    
    return insights
