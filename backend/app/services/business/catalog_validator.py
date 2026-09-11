"""
backend/app/services/business/catalog_validator.py

Validador de Saúde do Catálogo e Conhecimento Empresarial (BKL vNext)
"""

from typing import Dict, Any, List, Optional
from sqlalchemy import text


def evaluate_tenant_business_health(
    db,
    clean_tenant: str,
    intent_code: str,
    context_tables: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Avalia se o snapshot atual do tenant possui as tabelas necessárias para uma intenção.
    Registra/atualiza o status em {clean_tenant}.tenant_business_health.
    """
    # 1. Busca tabelas obrigatórias da intenção em public.business_intent_tables
    required_query = text("""
        SELECT bit.table_code, bit.required, bit.priority_order
        FROM public.business_intent_tables bit
        JOIN public.business_intents bi ON bi.id = bit.intent_id
        WHERE bi.intent_code = :intent_code
        ORDER BY bit.priority_order ASC
    """)
    required_rows = db.execute(required_query, {"intent_code": intent_code}).fetchall()

    if not required_rows:
        # Fallback se a intenção ainda não estiver nas tabelas do banco
        fallback_map = {
            "cash_flow": [("SE1", True), ("SE2", True), ("SE5", False)],
            "receivables": [("SE1", True), ("SA1", False)],
            "payables": [("SE2", True), ("SA2", False)],
            "billing": [("SF2", True), ("SD2", True), ("SA1", False)],
            "sales_orders": [("SC5", True), ("SC6", True), ("SA1", False)],
            "inventory_balance": [("SB2", True), ("SB1", False)],
            "purchases_entry": [("SF1", True), ("SD1", True), ("SA2", False)],
        }
        rules = fallback_map.get(intent_code, [])
        required_list = [{"table_code": r[0], "required": r[1]} for r in rules]
    else:
        required_list = [{"table_code": r[0], "required": bool(r[1])} for r in required_rows]

    # 2. Identifica tabelas disponíveis no contexto ativo do tenant
    available_codes = set()
    for item in context_tables:
        tbl = item.get("table") or {}
        code = str(tbl.get("table_code") or tbl.get("table_name") or "").strip().upper()
        if code:
            available_codes.add(code)

    required_codes = [r["table_code"] for r in required_list if r["required"]]
    missing_codes = [c for c in required_codes if not any(avail.startswith(c) for avail in available_codes)]

    status = "VALID" if not missing_codes else "INCOMPLETO"

    health_data = {
        "intent": intent_code,
        "required": [r["table_code"] for r in required_list],
        "available": sorted(list(available_codes)),
        "missing": missing_codes,
        "status": status,
    }

    # 3. Persiste a auditoria em tenant_business_health (idempotente)
    try:
        import json
        db.execute(text(f"""
            INSERT INTO "{clean_tenant}".tenant_business_health (intent_code, status, validation_json, validated_at)
            VALUES (:intent_code, :status, :vjson, NOW())
        """), {
            "intent_code": intent_code,
            "status": status,
            "vjson": json.dumps(health_data),
        })
        db.commit()
    except Exception:
        db.rollback()

    return health_data
