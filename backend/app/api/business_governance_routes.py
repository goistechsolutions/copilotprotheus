"""
business_governance_routes.py — Rotas de Governança do Conhecimento de Negócio (BKL vNext)

Endpoints administrativos para gerenciar:
  - Domínios ERP (business_domains + business_domain_modules)
  - Intents de Negócio (business_intents + business_intent_tables)
  - Dicionário Semântico / Aliases (business_field_aliases)
  - Métricas e KPIs (business_metrics)
  - Templates de Dashboards (business_dashboard_templates)
  - Regras de Negócio (business_rules)
  - Saúde do Conhecimento (tenant_business_health)
"""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin_security import require_admin
from app.db.database import get_db, ensure_tenant_tables, resolve_clean_tenant
from app.models.business_knowledge import (
    BusinessDomain,
    BusinessDomainModule,
    BusinessIntent,
    BusinessIntentTable,
    BusinessDashboardTemplate,
    BusinessFieldAlias,
    BusinessRule,
    BusinessMetric,
    TenantBusinessHealth,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/governance", tags=["business-governance"])


# ── SCHEMAS ────────────────────────────────────────────────────────
class DomainModuleItem(BaseModel):
    mod_sigla: str
    mod_code: int
    is_primary: bool = True

class DomainCreateUpdate(BaseModel):
    domain_code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = None
    active: bool = True
    modules: Optional[List[DomainModuleItem]] = None

class IntentTableItem(BaseModel):
    table_code: str
    required: bool = True
    priority_order: int = 1

class IntentCreateUpdate(BaseModel):
    domain_code: str
    intent_code: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    active: bool = True
    tables: Optional[List[IntentTableItem]] = None

class FieldAliasCreateUpdate(BaseModel):
    tenant_id: str
    field_name: str
    business_name: str
    field_format: Optional[str] = None
    field_description: Optional[str] = None

class MetricCreateUpdate(BaseModel):
    tenant_id: str
    metric_code: str
    metric_name: str
    metric_formula: str
    metric_type: str = "currency"

class DashboardTemplateCreateUpdate(BaseModel):
    intent_code: str
    dashboard_code: str
    layout_json: Dict[str, Any]

class BusinessRuleCreateUpdate(BaseModel):
    tenant_id: str
    intent_code: str
    rule_type: str
    rule_json: Dict[str, Any]


# ── 1. DOMÍNIOS ERP ────────────────────────────────────────────────
@router.get("/domains")
def list_business_domains(
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        domains = db.query(BusinessDomain).order_by(BusinessDomain.domain_code.asc()).all()
        modules = db.query(BusinessDomainModule).order_by(BusinessDomainModule.domain_code, BusinessDomainModule.is_primary.desc()).all()
        
        mods_by_domain: Dict[str, List[Dict[str, Any]]] = {}
        for m in modules:
            mods_by_domain.setdefault(m.domain_code, []).append({
                "id": m.id,
                "mod_sigla": m.mod_sigla,
                "mod_code": m.mod_code,
                "is_primary": m.is_primary,
            })
            
        return [
            {
                "domain_code": d.domain_code,
                "name": d.name,
                "description": d.description,
                "active": d.active,
                "created_at": d.created_at,
                "modules": mods_by_domain.get(d.domain_code, []),
            }
            for d in domains
        ]
    except Exception as exc:
        logger.exception("Erro ao listar domínios de negócio")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/domains", status_code=status.HTTP_201_CREATED)
def create_business_domain(
    payload: DomainCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    code = payload.domain_code.strip().upper()
    existing = db.query(BusinessDomain).filter(BusinessDomain.domain_code == code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Domínio '{code}' já existe.")
        
    try:
        domain = BusinessDomain(
            domain_code=code,
            name=payload.name.strip(),
            description=payload.description,
            active=payload.active,
        )
        db.add(domain)
        db.flush()
        
        if payload.modules:
            for m in payload.modules:
                db.add(BusinessDomainModule(
                    domain_code=code,
                    mod_sigla=m.mod_sigla.strip().upper(),
                    mod_code=m.mod_code,
                    is_primary=m.is_primary,
                ))
        db.commit()
        return {"success": True, "message": f"Domínio '{code}' criado com sucesso."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/domains/{domain_code}")
def update_business_domain(
    domain_code: str,
    payload: DomainCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    domain = db.query(BusinessDomain).filter(BusinessDomain.domain_code == domain_code).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domínio não encontrado.")
        
    try:
        domain.name = payload.name.strip()
        domain.description = payload.description
        domain.active = payload.active
        
        if payload.modules is not None:
            db.query(BusinessDomainModule).filter(BusinessDomainModule.domain_code == domain.domain_code).delete()
            for m in payload.modules:
                db.add(BusinessDomainModule(
                    domain_code=domain.domain_code,
                    mod_sigla=m.mod_sigla.strip().upper(),
                    mod_code=m.mod_code,
                    is_primary=m.is_primary,
                ))
        db.commit()
        return {"success": True, "message": f"Domínio '{domain.domain_code}' atualizado."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/domains/{domain_code}")
def delete_business_domain(
    domain_code: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    domain = db.query(BusinessDomain).filter(BusinessDomain.domain_code == domain_code).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domínio não encontrado.")
    try:
        db.delete(domain)
        db.commit()
        return {"success": True, "message": f"Domínio '{domain.domain_code}' removido."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 2. INTENTS ─────────────────────────────────────────────────────
@router.get("/intents")
def list_business_intents(
    domain_code: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        query = db.query(BusinessIntent, BusinessDomain).join(
            BusinessDomain, BusinessIntent.domain_code == BusinessDomain.domain_code
        )
        if domain_code:
            query = query.filter(BusinessDomain.domain_code == domain_code.strip().upper())
            
        rows = query.order_by(BusinessDomain.domain_code, BusinessIntent.name).all()
        intent_ids = [r[0].id for r in rows]
        
        tables_by_intent: Dict[int, List[Dict[str, Any]]] = {}
        if intent_ids:
            it_rows = db.query(BusinessIntentTable).filter(
                BusinessIntentTable.intent_id.in_(intent_ids)
            ).order_by(BusinessIntentTable.priority_order.asc()).all()
            for t in it_rows:
                tables_by_intent.setdefault(t.intent_id, []).append({
                    "id": t.id,
                    "table_code": t.table_code,
                    "required": t.required,
                    "priority_order": t.priority_order,
                })
                
        return [
            {
                "id": intent.id,
                "intent_code": intent.intent_code,
                "name": intent.name,
                "description": intent.description,
                "active": intent.active,
                "domain_code": domain.domain_code,
                "domain_name": domain.name,
                "created_at": intent.created_at,
                "tables": tables_by_intent.get(intent.id, []),
            }
            for intent, domain in rows
        ]
    except Exception as exc:
        logger.exception("Erro ao listar intenções de negócio")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/intents", status_code=status.HTTP_201_CREATED)
def create_business_intent(
    payload: IntentCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    domain = db.query(BusinessDomain).filter(
        BusinessDomain.domain_code == payload.domain_code.strip().upper()
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail=f"Domínio '{payload.domain_code}' não existe.")
        
    icode = payload.intent_code.strip().lower()
    if db.query(BusinessIntent).filter(BusinessIntent.intent_code == icode).first():
        raise HTTPException(status_code=409, detail=f"Intent '{icode}' já existe.")
        
    try:
        intent = BusinessIntent(
            domain_code=domain.domain_code,
            intent_code=icode,
            name=payload.name.strip(),
            description=payload.description,
            active=payload.active,
        )
        db.add(intent)
        db.flush()
        
        if payload.tables:
            for t in payload.tables:
                db.add(BusinessIntentTable(
                    intent_id=intent.id,
                    table_code=t.table_code.strip().upper(),
                    required=t.required,
                    priority_order=t.priority_order,
                ))
        db.commit()
        return {"success": True, "message": f"Intent '{icode}' criada com sucesso."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/intents/{intent_id}")
def update_business_intent(
    intent_id: int,
    payload: IntentCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    intent = db.query(BusinessIntent).filter(BusinessIntent.id == intent_id).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent não encontrada.")
        
    domain = db.query(BusinessDomain).filter(
        BusinessDomain.domain_code == payload.domain_code.strip().upper()
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail=f"Domínio '{payload.domain_code}' não existe.")
        
    try:
        intent.domain_code = domain.domain_code
        intent.name = payload.name.strip()
        intent.description = payload.description
        intent.active = payload.active
        
        if payload.tables is not None:
            db.query(BusinessIntentTable).filter(BusinessIntentTable.intent_id == intent.id).delete()
            for t in payload.tables:
                db.add(BusinessIntentTable(
                    intent_id=intent.id,
                    table_code=t.table_code.strip().upper(),
                    required=t.required,
                    priority_order=t.priority_order,
                ))
        db.commit()
        return {"success": True, "message": f"Intent '{intent.intent_code}' atualizada."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/intents/{intent_id}")
def delete_business_intent(
    intent_id: int,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    intent = db.query(BusinessIntent).filter(BusinessIntent.id == intent_id).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent não encontrada.")
    try:
        db.delete(intent)
        db.commit()
        return {"success": True, "message": f"Intent '{intent.intent_code}' removida."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 3. DICIONÁRIO SEMÂNTICO ────────────────────────────────────────
@router.get("/semantic-dictionary")
def list_semantic_field_aliases(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        rows = db.execute(text(f"""
            SELECT id, field_name, business_name, field_format, field_description, created_at
            FROM "{clean_tenant}".business_field_aliases
            ORDER BY field_name ASC
        """)).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/semantic-dictionary", status_code=status.HTTP_201_CREATED)
def create_semantic_field_alias(
    payload: FieldAliasCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, payload.tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f"""
            INSERT INTO "{clean_tenant}".business_field_aliases
                (field_name, business_name, field_format, field_description)
            VALUES
                (:field_name, :business_name, :field_format, :field_description)
        """), {
            "field_name": payload.field_name.strip().upper(),
            "business_name": payload.business_name.strip(),
            "field_format": payload.field_format,
            "field_description": payload.field_description,
        })
        db.commit()
        return {"success": True, "message": f"Alias para '{payload.field_name}' cadastrado."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/semantic-dictionary/{alias_id}")
def delete_semantic_field_alias(
    alias_id: int,
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'DELETE FROM "{clean_tenant}".business_field_aliases WHERE id = :id'), {"id": alias_id})
        db.commit()
        return {"success": True, "message": "Alias removido."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 4. MÉTRICAS E KPIS ─────────────────────────────────────────────
@router.get("/metrics")
def list_business_metrics(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        rows = db.execute(text(f"""
            SELECT id, metric_code, metric_name, metric_formula, metric_type, created_at
            FROM "{clean_tenant}".business_metrics
            ORDER BY metric_name ASC
        """)).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/metrics", status_code=status.HTTP_201_CREATED)
def create_business_metric(
    payload: MetricCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, payload.tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f"""
            INSERT INTO "{clean_tenant}".business_metrics
                (metric_code, metric_name, metric_formula, metric_type)
            VALUES
                (:code, :name, :formula, :mtype)
        """), {
            "code": payload.metric_code.strip().lower(),
            "name": payload.metric_name.strip(),
            "formula": payload.metric_formula.strip(),
            "mtype": payload.metric_type,
        })
        db.commit()
        return {"success": True, "message": f"Métrica '{payload.metric_name}' cadastrada."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/metrics/{metric_id}")
def delete_business_metric(
    metric_id: int,
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'DELETE FROM "{clean_tenant}".business_metrics WHERE id = :id'), {"id": metric_id})
        db.commit()
        return {"success": True, "message": "Métrica removida."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 5. DASHBOARDS ──────────────────────────────────────────────────
@router.get("/dashboards")
def list_business_dashboards(
    intent_code: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        query = db.query(BusinessDashboardTemplate, BusinessIntent).join(
            BusinessIntent, BusinessDashboardTemplate.intent_id == BusinessIntent.id
        )
        if intent_code:
            query = query.filter(BusinessIntent.intent_code == intent_code.strip().lower())
            
        rows = query.order_by(BusinessIntent.intent_code).all()
        return [
            {
                "id": tpl.id,
                "dashboard_code": tpl.dashboard_code,
                "intent_id": intent.id,
                "intent_code": intent.intent_code,
                "intent_name": intent.name,
                "layout_json": tpl.layout_json,
                "created_at": tpl.created_at,
            }
            for tpl, intent in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dashboards", status_code=status.HTTP_201_CREATED)
def create_business_dashboard(
    payload: DashboardTemplateCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    intent = db.query(BusinessIntent).filter(
        BusinessIntent.intent_code == payload.intent_code.strip().lower()
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent de negócio não encontrada.")
        
    try:
        tpl = BusinessDashboardTemplate(
            intent_id=intent.id,
            dashboard_code=payload.dashboard_code.strip().lower(),
            layout_json=payload.layout_json,
        )
        db.add(tpl)
        db.commit()
        return {"success": True, "message": f"Dashboard '{payload.dashboard_code}' cadastrado."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/dashboards/{dashboard_id}")
def delete_business_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    tpl = db.query(BusinessDashboardTemplate).filter(BusinessDashboardTemplate.id == dashboard_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado.")
    try:
        db.delete(tpl)
        db.commit()
        return {"success": True, "message": "Dashboard removido."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 6. REGRAS DE NEGÓCIO ───────────────────────────────────────────
@router.get("/business-rules")
def list_business_rules(
    tenant_id: str,
    intent_code: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        scope = "WHERE intent_code = :icode" if intent_code else ""
        params = {"icode": intent_code.strip().lower()} if intent_code else {}
        rows = db.execute(text(f"""
            SELECT id, intent_code, rule_type, rule_json, created_at
            FROM "{clean_tenant}".business_rules
            {scope}
            ORDER BY intent_code, rule_type
        """), params).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/business-rules", status_code=status.HTTP_201_CREATED)
def create_business_rule(
    payload: BusinessRuleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, payload.tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f"""
            INSERT INTO "{clean_tenant}".business_rules
                (intent_code, rule_type, rule_json)
            VALUES
                (:icode, :rtype, :rjson)
        """), {
            "icode": payload.intent_code.strip().lower(),
            "rtype": payload.rule_type.strip(),
            "rjson": json.dumps(payload.rule_json),
        })
        db.commit()
        return {"success": True, "message": "Regra de negócio salva."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/business-rules/{rule_id}")
def delete_business_rule(
    rule_id: int,
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'DELETE FROM "{clean_tenant}".business_rules WHERE id = :id'), {"id": rule_id})
        db.commit()
        return {"success": True, "message": "Regra removida."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# ── 7. SAÚDE DO CONHECIMENTO ───────────────────────────────────────
@router.get("/health")
def get_business_knowledge_health(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        
        intents = db.query(BusinessIntent, BusinessDomain).join(
            BusinessDomain, BusinessIntent.domain_code == BusinessDomain.domain_code
        ).filter(BusinessIntent.active == True).all()
        
        intent_tables = db.query(BusinessIntentTable).all()
        req_tables_by_intent: Dict[int, List[str]] = {}
        for it in intent_tables:
            req_tables_by_intent.setdefault(it.intent_id, []).append(it.table_code.upper())
            
        synced_rows = db.execute(text(f"""
            SELECT DISTINCT UPPER(table_code) AS table_code
            FROM "{clean_tenant}".dictionary_tables
            WHERE active_flag = TRUE
        """)).scalars().all()
        synced_tables = set(synced_rows)
        
        health_report = []
        for intent, domain in intents:
            required = req_tables_by_intent.get(intent.id, [])
            missing = [t for t in required if t not in synced_tables]
            present = [t for t in required if t in synced_tables]
            
            if not required:
                status_calc = "healthy"
            elif not missing:
                status_calc = "healthy"
            elif len(missing) < len(required):
                status_calc = "warning"
            else:
                status_calc = "critical"
                
            health_report.append({
                "intent_code": intent.intent_code,
                "intent_name": intent.name,
                "domain_code": domain.domain_code,
                "domain_name": domain.name,
                "status": status_calc,
                "required_tables": required,
                "synced_tables": present,
                "missing_tables": missing,
                "coverage_pct": round(len(present) / len(required) * 100, 1) if required else 100.0,
            })
            
        total_healthy = sum(1 for h in health_report if h["status"] == "healthy")
        total_warning = sum(1 for h in health_report if h["status"] == "warning")
        total_critical = sum(1 for h in health_report if h["status"] == "critical")
        
        return {
            "tenant_id": tenant_id,
            "overall_status": "critical" if total_critical > 0 else ("warning" if total_warning > 0 else "healthy"),
            "summary": {
                "total_intents": len(health_report),
                "healthy": total_healthy,
                "warning": total_warning,
                "critical": total_critical,
                "synced_tables_count": len(synced_tables),
            },
            "intents": health_report,
        }
    except Exception as exc:
        logger.exception("Erro ao verificar saúde do conhecimento do tenant=%s", tenant_id)
        raise HTTPException(status_code=400, detail=str(exc))
