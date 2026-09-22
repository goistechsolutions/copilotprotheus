"""
backend/app/api/business_rules_routes.py

Rotas REST do Business Rules Center (Portal de Regras de Negócio por Tenant):
- /api/admin/business-rules/overview
- /api/admin/business-rules/tes
- /api/admin/business-rules/cfop
- /api/admin/business-rules/financial-natures
- /api/admin/business-rules/synonyms
- /api/admin/business-rules/config
- /api/admin/business-rules/audit
"""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin_security import authorize_admin_access, require_admin, require_admin_permission
from app.db.database import get_db, resolve_clean_tenant
from app.services.business_rules_engine import BusinessRulesEngine

logger = logging.getLogger("app.business_rules_routes")

router = APIRouter(prefix="/admin/business-rules", tags=["business-rules-center"])

BUSINESS_RULES_READ_PERMISSION = "business_rules:read"
BUSINESS_RULES_WRITE_PERMISSION = "business_rules:write"


def _authorize_business_rules(admin: dict, tenant_id: str, permission: str) -> str:
    return authorize_admin_access(admin, permission, tenant_id) or ""


# Fonte única das opções exibidas pelo Business Rules Center. Os valores
# permanecem compatíveis com as tabelas legadas enquanto a migração para
# códigos técnicos está sendo preparada.
BUSINESS_RULES_METADATA = {
    "version": 1,
    "classifications": {
        "tes": [
            {"value": "VENDA", "label": "Venda", "directions": ["saida"]},
            {"value": "BONIFICACAO", "label": "Bonificação", "directions": ["saida", "entrada"]},
            {"value": "DEVOLUCAO", "label": "Devolução", "directions": ["saida", "entrada"]},
            {"value": "REMESSA", "label": "Remessa", "directions": ["saida", "entrada"]},
            {"value": "TRANSFERENCIA", "label": "Transferência", "directions": ["saida", "entrada"]},
            {"value": "EXPORTACAO", "label": "Exportação", "directions": ["saida"]},
            {"value": "COMPRA", "label": "Compra", "directions": ["entrada"]},
            {"value": "CONSIGNACAO", "label": "Consignação", "directions": ["saida", "entrada"]},
            {"value": "MOSTRUARIO", "label": "Mostruário", "directions": ["saida", "entrada"]},
            {"value": "OUTROS", "label": "Outros", "directions": ["saida", "entrada"]},
        ],
        "cfop": [
            {"value": "VENDA", "label": "Venda"},
            {"value": "DEVOLUCAO", "label": "Devolução"},
            {"value": "REMESSA", "label": "Remessa"},
            {"value": "TRANSFERENCIA", "label": "Transferência"},
            {"value": "COMPRA", "label": "Compra"},
            {"value": "OUTROS", "label": "Outros"},
        ],
    },
    "financialGroups": [
        {"value": "RECEITA", "label": "Receita"},
        {"value": "CUSTO", "label": "Custo"},
        {"value": "DESPESA", "label": "Despesa"},
        {"value": "INVESTIMENTO", "label": "Investimento"},
        {"value": "IMPOSTO", "label": "Imposto"},
        {"value": "OPERACAO_FINANCEIRA", "label": "Operação Financeira"},
    ],
    "cashFlowTables": ["SE1", "SE2", "SE5"],
    "defaults": {
        "billing_included_classifications": ["VENDA", "EXPORTACAO"],
        "billing_excluded_classifications": ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"],
        "receivables_overdue_days": 30,
        "receivables_include_renegotiated": False,
        "receivables_include_provisional": True,
        "stock_idle_days": 90,
        "stock_critical_days": 7,
        "stock_rupture_days": 3,
        "abc_curve_a_pct": 80.0,
        "abc_curve_b_pct": 15.0,
        "abc_curve_c_pct": 5.0,
        "ai_cash_flow_tables": ["SE1", "SE2", "SE5"],
    },
}


# ── SCHEMAS ────────────────────────────────────────────────────────
class TesRuleCreate(BaseModel):
    tenant_id: str
    tes: str = Field(..., max_length=10)
    direction: str = Field(default="saida", description="saida ou entrada")
    classification: str = Field(..., max_length=50)
    description: Optional[str] = None
    active: bool = True

class CfopRuleCreate(BaseModel):
    tenant_id: str
    cfop: str = Field(..., max_length=10)
    classification: str = Field(..., max_length=50)

class FinancialNatureCreate(BaseModel):
    tenant_id: str
    nature_code: str = Field(..., max_length=20)
    nature_name: str = Field(..., max_length=200)
    financial_group: str = Field(..., max_length=100)

class SynonymCreate(BaseModel):
    tenant_id: str
    source_term: str = Field(..., max_length=200)
    target_term: str = Field(..., max_length=200)

class ModuleConfigUpdate(BaseModel):
    tenant_id: str
    billing_included_classifications: Optional[List[str]] = None
    billing_excluded_classifications: Optional[List[str]] = None
    receivables_overdue_days: Optional[int] = 30
    receivables_include_renegotiated: Optional[bool] = False
    receivables_include_provisional: Optional[bool] = True
    stock_idle_days: Optional[int] = 90
    stock_critical_days: Optional[int] = 7
    stock_rupture_days: Optional[int] = 3
    abc_curve_a_pct: Optional[float] = 80.0
    abc_curve_b_pct: Optional[float] = 15.0
    abc_curve_c_pct: Optional[float] = 5.0
    ai_cash_flow_tables: Optional[List[str]] = None


# ── 0. METADATA ─────────────────────────────────────────────────────
@router.get("/metadata")
def get_business_rules_metadata(admin: dict = Depends(require_admin_permission(BUSINESS_RULES_READ_PERMISSION))):
    """Retorna opções e defaults canônicos para o painel administrativo."""
    return BUSINESS_RULES_METADATA


# ── 1. VISÃO GERAL / OVERVIEW ──────────────────────────────────────
@router.get("/overview")
def get_business_rules_overview(
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    try:
        tes_count = db.execute(text("SELECT COUNT(*) FROM public.business_rule_tes WHERE tenant_id = :tid"), {"tid": tid}).scalar() or 0
        cfop_count = db.execute(text("SELECT COUNT(*) FROM public.business_cfop_rules WHERE tenant_id = :tid"), {"tid": tid}).scalar() or 0
        nature_count = db.execute(text("SELECT COUNT(*) FROM public.business_financial_natures WHERE tenant_id = :tid"), {"tid": tid}).scalar() or 0
        synonym_count = db.execute(text("SELECT COUNT(*) FROM public.business_synonyms WHERE tenant_id = :tid"), {"tid": tid}).scalar() or 0

        last_audit = db.execute(text("""
            SELECT event_date, rule_entity, action, user_id
            FROM public.business_rule_audit
            WHERE tenant_id = :tid
            ORDER BY event_date DESC
            LIMIT 1
        """), {"tid": tid}).mappings().first()

        total_rules = tes_count + cfop_count + nature_count + synonym_count

        return {
            "tenant_id": tenant_id,
            "total_active_rules": total_rules,
            "tes_count": tes_count,
            "cfop_count": cfop_count,
            "financial_natures_count": nature_count,
            "synonyms_count": synonym_count,
            "last_update": last_audit["event_date"].isoformat() if last_audit else None,
            "last_entity_updated": last_audit["rule_entity"] if last_audit else None,
        }
    except Exception as exc:
        logger.error("Erro ao obter overview de regras: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── 2. CADASTRO DE TES (SAÍDA / ENTRADA) ────────────────────────────
@router.get("/tes")
def list_tes_rules(
    tenant_id: str = Query(...),
    direction: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    sql = "SELECT id, tes, direction, classification, description, active, created_at FROM public.business_rule_tes WHERE tenant_id = :tid"
    params = {"tid": tid}
    if direction:
        sql += " AND direction = :direction"
        params["direction"] = direction.strip().lower()
    sql += " ORDER BY tes ASC"

    rows = db.execute(text(sql), params).mappings().all()
    res = []
    for r in rows:
        item = dict(r)
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
        res.append(item)
    return res


@router.post("/tes", status_code=status.HTTP_201_CREATED)
def create_or_update_tes_rule(
    payload: TesRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, payload.tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    clean_tes = str(payload.tes).strip()
    rule_id = uuid.uuid4().hex
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)

    existing = db.execute(text("""
        SELECT id, classification, description, active FROM public.business_rule_tes
        WHERE tenant_id = :tid AND tes = :tes AND direction = :dir
    """), {"tid": tid, "tes": clean_tes, "dir": payload.direction.lower()}).mappings().first()

    if existing:
        db.execute(text("""
            UPDATE public.business_rule_tes
            SET classification = :cls, description = :desc, active = :act
            WHERE id = :id
        """), {
            "id": existing["id"],
            "cls": payload.classification.strip(),
            "desc": payload.description,
            "act": payload.active,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "TES", "UPDATE", dict(existing), payload.dict(), trace_id=trace_id)
    else:
        db.execute(text("""
            INSERT INTO public.business_rule_tes
                (id, tenant_id, tes, direction, classification, description, active, created_at)
            VALUES
                (:id, :tid, :tes, :dir, :cls, :desc, :act, NOW())
        """), {
            "id": rule_id,
            "tid": tid,
            "tes": clean_tes,
            "dir": payload.direction.lower(),
            "cls": payload.classification.strip(),
            "desc": payload.description,
            "act": payload.active,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "TES", "CREATE", None, payload.dict(), trace_id=trace_id)

    db.commit()
    return {"success": True, "message": f"TES {clean_tes} cadastrada/atualizada com sucesso."}


@router.delete("/tes/{rule_id}")
def delete_tes_rule(
    rule_id: str,
    request: Request,
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)
    existing = db.execute(text("SELECT * FROM public.business_rule_tes WHERE id = :id AND tenant_id = :tid"), {"id": rule_id, "tid": tid}).mappings().first()
    if existing:
        db.execute(text("DELETE FROM public.business_rule_tes WHERE id = :id"), {"id": rule_id})
        BusinessRulesEngine.audit_change(db, tid, admin, "TES", "DELETE", dict(existing), None, trace_id=trace_id)
        db.commit()
    return {"success": True, "message": "Regra de TES removida."}


# ── 3. CADASTRO DE CFOP ────────────────────────────────────────────
@router.get("/cfop")
def list_cfop_rules(
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    rows = db.execute(text("""
        SELECT id, cfop, classification, created_at
        FROM public.business_cfop_rules
        WHERE tenant_id = :tid
        ORDER BY cfop ASC
    """), {"tid": tid}).mappings().all()
    res = []
    for r in rows:
        item = dict(r)
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
        res.append(item)
    return res


@router.post("/cfop", status_code=status.HTTP_201_CREATED)
def create_or_update_cfop_rule(
    payload: CfopRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, payload.tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    clean_cfop = str(payload.cfop).strip()
    rule_id = uuid.uuid4().hex
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)

    existing = db.execute(text("""
        SELECT id, classification FROM public.business_cfop_rules
        WHERE tenant_id = :tid AND cfop = :cfop
    """), {"tid": tid, "cfop": clean_cfop}).mappings().first()

    if existing:
        db.execute(text("UPDATE public.business_cfop_rules SET classification = :cls WHERE id = :id"), {
            "id": existing["id"],
            "cls": payload.classification.strip(),
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "CFOP", "UPDATE", dict(existing), payload.dict(), trace_id=trace_id)
    else:
        db.execute(text("""
            INSERT INTO public.business_cfop_rules (id, tenant_id, cfop, classification, created_at)
            VALUES (:id, :tid, :cfop, :cls, NOW())
        """), {
            "id": rule_id,
            "tid": tid,
            "cfop": clean_cfop,
            "cls": payload.classification.strip(),
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "CFOP", "CREATE", None, payload.dict(), trace_id=trace_id)

    db.commit()
    return {"success": True, "message": f"CFOP {clean_cfop} cadastrado com sucesso."}


@router.delete("/cfop/{rule_id}")
def delete_cfop_rule(
    rule_id: str,
    request: Request,
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)
    existing = db.execute(text("SELECT * FROM public.business_cfop_rules WHERE id = :id AND tenant_id = :tid"), {"id": rule_id, "tid": tid}).mappings().first()
    if existing:
        db.execute(text("DELETE FROM public.business_cfop_rules WHERE id = :id"), {"id": rule_id})
        BusinessRulesEngine.audit_change(db, tid, admin, "CFOP", "DELETE", dict(existing), None, trace_id=trace_id)
        db.commit()
    return {"success": True, "message": "Regra CFOP removida."}


# ── 4. NATUREZAS FINANCEIRAS ───────────────────────────────────────
@router.get("/financial-natures")
def list_financial_natures(
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    rows = db.execute(text("""
        SELECT id, nature_code, nature_name, financial_group, created_at
        FROM public.business_financial_natures
        WHERE tenant_id = :tid
        ORDER BY nature_code ASC
    """), {"tid": tid}).mappings().all()
    res = []
    for r in rows:
        item = dict(r)
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
        res.append(item)
    return res


@router.post("/financial-natures", status_code=status.HTTP_201_CREATED)
def create_financial_nature(
    payload: FinancialNatureCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, payload.tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    clean_code = str(payload.nature_code).strip()
    rule_id = uuid.uuid4().hex
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)

    existing = db.execute(text("""
        SELECT id, nature_name, financial_group FROM public.business_financial_natures
        WHERE tenant_id = :tid AND nature_code = :nc
    """), {"tid": tid, "nc": clean_code}).mappings().first()

    if existing:
        db.execute(text("""
            UPDATE public.business_financial_natures
            SET nature_name = :nm, financial_group = :grp
            WHERE id = :id
        """), {
            "id": existing["id"],
            "nm": payload.nature_name.strip(),
            "grp": payload.financial_group.strip(),
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "NATUREZA_FINANCEIRA", "UPDATE", dict(existing), payload.dict(), trace_id=trace_id)
    else:
        db.execute(text("""
            INSERT INTO public.business_financial_natures
                (id, tenant_id, nature_code, nature_name, financial_group, created_at)
            VALUES
                (:id, :tid, :nc, :nm, :grp, NOW())
        """), {
            "id": rule_id,
            "tid": tid,
            "nc": clean_code,
            "nm": payload.nature_name.strip(),
            "grp": payload.financial_group.strip(),
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "NATUREZA_FINANCEIRA", "CREATE", None, payload.dict(), trace_id=trace_id)

    db.commit()
    return {"success": True, "message": f"Natureza {clean_code} salva com sucesso."}


@router.delete("/financial-natures/{rule_id}")
def delete_financial_nature(
    rule_id: str,
    request: Request,
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)
    existing = db.execute(text("SELECT * FROM public.business_financial_natures WHERE id = :id AND tenant_id = :tid"), {"id": rule_id, "tid": tid}).mappings().first()
    if existing:
        db.execute(text("DELETE FROM public.business_financial_natures WHERE id = :id"), {"id": rule_id})
        BusinessRulesEngine.audit_change(db, tid, admin, "NATUREZA_FINANCEIRA", "DELETE", dict(existing), None, trace_id=trace_id)
        db.commit()
    return {"success": True, "message": "Natureza Financeira removida."}


# ── 5. SINÔNIMOS EMPRESARIAIS ──────────────────────────────────────
@router.get("/synonyms")
def list_synonyms(
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    rows = db.execute(text("""
        SELECT id, source_term, target_term, created_at
        FROM public.business_synonyms
        WHERE tenant_id = :tid
        ORDER BY source_term ASC
    """), {"tid": tid}).mappings().all()
    res = []
    for r in rows:
        item = dict(r)
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
        res.append(item)
    return res


@router.post("/synonyms", status_code=status.HTTP_201_CREATED)
def create_synonym(
    payload: SynonymCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, payload.tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    clean_src = payload.source_term.strip()
    clean_tgt = payload.target_term.strip()
    rule_id = uuid.uuid4().hex
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)

    existing = db.execute(text("""
        SELECT id, target_term FROM public.business_synonyms
        WHERE tenant_id = :tid AND source_term = :src
    """), {"tid": tid, "src": clean_src}).mappings().first()

    if existing:
        db.execute(text("UPDATE public.business_synonyms SET target_term = :tgt WHERE id = :id"), {
            "id": existing["id"],
            "tgt": clean_tgt,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "SINÔNIMO", "UPDATE", dict(existing), payload.dict(), trace_id=trace_id)
    else:
        db.execute(text("""
            INSERT INTO public.business_synonyms (id, tenant_id, source_term, target_term, created_at)
            VALUES (:id, :tid, :src, :tgt, NOW())
        """), {
            "id": rule_id,
            "tid": tid,
            "src": clean_src,
            "tgt": clean_tgt,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "SINÔNIMO", "CREATE", None, payload.dict(), trace_id=trace_id)

    db.commit()
    return {"success": True, "message": f"Sinônimo '{clean_src}' -> '{clean_tgt}' salvo com sucesso."}


@router.delete("/synonyms/{rule_id}")
def delete_synonym(
    rule_id: str,
    request: Request,
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)
    existing = db.execute(text("SELECT * FROM public.business_synonyms WHERE id = :id AND tenant_id = :tid"), {"id": rule_id, "tid": tid}).mappings().first()
    if existing:
        db.execute(text("DELETE FROM public.business_synonyms WHERE id = :id"), {"id": rule_id})
        BusinessRulesEngine.audit_change(db, tid, admin, "SINÔNIMO", "DELETE", dict(existing), None, trace_id=trace_id)
        db.commit()
    return {"success": True, "message": "Sinônimo removido."}


# ── 6. CONFIGURAÇÕES GERAIS (ESTOQUE, RECEBÍVEIS, ABC, FATURAMENTO) ─
@router.get("/config")
def get_module_config(
    tenant_id: str = Query(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    cfg = db.execute(text("""
        SELECT * FROM public.business_module_configs
        WHERE tenant_id = :tid
    """), {"tid": tid}).mappings().first()

    if not cfg:
        # Retorna defaults
        return {
            "_source": "DEFAULT",
            "tenant_id": tenant_id,
            "billing_included_classifications": ["VENDA", "EXPORTACAO"],
            "billing_excluded_classifications": ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"],
            "receivables_overdue_days": 30,
            "receivables_include_renegotiated": False,
            "receivables_include_provisional": True,
            "stock_idle_days": 90,
            "stock_critical_days": 7,
            "stock_rupture_days": 3,
            "abc_curve_a_pct": 80.0,
            "abc_curve_b_pct": 15.0,
            "abc_curve_c_pct": 5.0,
            "ai_cash_flow_tables": ["SE1", "SE2", "SE5"],
        }

    res = dict(cfg)
    res["_source"] = "EXPLICIT"
    for k in ["billing_included_classifications", "billing_excluded_classifications", "ai_cash_flow_tables"]:
        if isinstance(res.get(k), str):
            try:
                res[k] = json.loads(res[k])
            except Exception:
                pass
    return res


@router.put("/config")
def update_module_config(
    payload: ModuleConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, payload.tenant_id, BUSINESS_RULES_WRITE_PERMISSION)
    existing = db.execute(text("SELECT * FROM public.business_module_configs WHERE tenant_id = :tid"), {"tid": tid}).mappings().first()
    cfg_id = existing["id"] if existing else uuid.uuid4().hex
    trace_id = request.headers.get("x-trace-id", uuid.uuid4().hex)

    b_inc = json.dumps(payload.billing_included_classifications or ["VENDA", "EXPORTACAO"])
    b_exc = json.dumps(payload.billing_excluded_classifications or ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"])
    ai_cf = json.dumps(payload.ai_cash_flow_tables or ["SE1", "SE2", "SE5"])

    if existing:
        db.execute(text("""
            UPDATE public.business_module_configs
            SET billing_included_classifications = :b_inc,
                billing_excluded_classifications = :b_exc,
                receivables_overdue_days = :rec_days,
                receivables_include_renegotiated = :rec_ren,
                receivables_include_provisional = :rec_prov,
                stock_idle_days = :stk_idle,
                stock_critical_days = :stk_crit,
                stock_rupture_days = :stk_rupt,
                abc_curve_a_pct = :abc_a,
                abc_curve_b_pct = :abc_b,
                abc_curve_c_pct = :abc_c,
                ai_cash_flow_tables = :ai_cf,
                updated_at = NOW()
            WHERE id = :id
        """), {
            "id": cfg_id,
            "b_inc": b_inc,
            "b_exc": b_exc,
            "rec_days": payload.receivables_overdue_days,
            "rec_ren": payload.receivables_include_renegotiated,
            "rec_prov": payload.receivables_include_provisional,
            "stk_idle": payload.stock_idle_days,
            "stk_crit": payload.stock_critical_days,
            "stk_rupt": payload.stock_rupture_days,
            "abc_a": payload.abc_curve_a_pct,
            "abc_b": payload.abc_curve_b_pct,
            "abc_c": payload.abc_curve_c_pct,
            "ai_cf": ai_cf,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "CONFIGURAÇÃO_MÓDULOS", "UPDATE", dict(existing), payload.dict(), trace_id=trace_id)
    else:
        db.execute(text("""
            INSERT INTO public.business_module_configs
                (id, tenant_id, billing_included_classifications, billing_excluded_classifications,
                 receivables_overdue_days, receivables_include_renegotiated, receivables_include_provisional,
                 stock_idle_days, stock_critical_days, stock_rupture_days,
                 abc_curve_a_pct, abc_curve_b_pct, abc_curve_c_pct, ai_cash_flow_tables, created_at, updated_at)
            VALUES
                (:id, :tid, :b_inc, :b_exc, :rec_days, :rec_ren, :rec_prov,
                 :stk_idle, :stk_crit, :stk_rupt, :abc_a, :abc_b, :abc_c, :ai_cf, NOW(), NOW())
        """), {
            "id": cfg_id,
            "tid": tid,
            "b_inc": b_inc,
            "b_exc": b_exc,
            "rec_days": payload.receivables_overdue_days,
            "rec_ren": payload.receivables_include_renegotiated,
            "rec_prov": payload.receivables_include_provisional,
            "stk_idle": payload.stock_idle_days,
            "stk_crit": payload.stock_critical_days,
            "stk_rupt": payload.stock_rupture_days,
            "abc_a": payload.abc_curve_a_pct,
            "abc_b": payload.abc_curve_b_pct,
            "abc_c": payload.abc_curve_c_pct,
            "ai_cf": ai_cf,
        })
        BusinessRulesEngine.audit_change(db, tid, admin, "CONFIGURAÇÃO_MÓDULOS", "CREATE", None, payload.dict(), trace_id=trace_id)

    db.commit()
    return {"success": True, "message": "Configurações de regras salvas com sucesso."}


# ── 7. AUDITORIA ───────────────────────────────────────────────────
@router.get("/audit")
def list_business_rules_audit(
    tenant_id: str = Query(...),
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    tid = _authorize_business_rules(admin, tenant_id, BUSINESS_RULES_READ_PERMISSION)
    rows = db.execute(text("""
        SELECT id, user_id, event_date, rule_entity, action, previous_value, new_value, trace_id
        FROM public.business_rule_audit
        WHERE tenant_id = :tid
        ORDER BY event_date DESC
        LIMIT :lim
    """), {"tid": tid, "lim": limit}).mappings().all()

    res = []
    for r in rows:
        item = dict(r)
        if item.get("event_date"):
            item["event_date"] = item["event_date"].isoformat()
        if isinstance(item.get("previous_value"), str):
            try: item["previous_value"] = json.loads(item["previous_value"])
            except Exception: pass
        if isinstance(item.get("new_value"), str):
            try: item["new_value"] = json.loads(item["new_value"])
            except Exception: pass
        res.append(item)
    return res
