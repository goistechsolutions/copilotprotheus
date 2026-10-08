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

from app.core.admin_security import require_admin, authorize_admin_access
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
    synonyms: Optional[str] = None

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
        
        intent_counts = dict(db.execute(text("SELECT domain_code, count(*) FROM public.business_intents GROUP BY domain_code")).fetchall())
        table_counts = dict(db.execute(text("""
            SELECT bi.domain_code, count(DISTINCT bit.table_code)
            FROM public.business_intents bi
            JOIN public.business_intent_tables bit ON bi.id = bit.intent_id
            GROUP BY bi.domain_code
        """)).fetchall())

        from app.models.knowledge import ProtheusModuleMaster
        master_map = {m.id: m for m in db.query(ProtheusModuleMaster).all()}

        mods_by_domain: Dict[str, List[Dict[str, Any]]] = {}
        for m in modules:
            master = master_map.get(m.module_id)
            mods_by_domain.setdefault(m.domain_code, []).append({
                "id": m.module_id,
                "module_id": m.module_id,
                "mod_sigla": master.module_sigla if master else "",
                "mod_code": m.module_id,
                "description": master.description if master else "",
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
                "intent_count": intent_counts.get(d.domain_code, 0),
                "table_count": table_counts.get(d.domain_code, 0),
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
            from app.models.knowledge import ProtheusModuleMaster
            for m in payload.modules:
                mod_sigla_upper = m.mod_sigla.strip().upper()
                master_mod = db.query(ProtheusModuleMaster).filter(
                    ProtheusModuleMaster.id == m.mod_code,
                    ProtheusModuleMaster.module_sigla == mod_sigla_upper
                ).first()
                if not master_mod:
                    db.rollback()
                    raise HTTPException(status_code=400, detail=f"Módulo '{mod_sigla_upper}' com código '{m.mod_code}' não existe no catálogo master.")
                    
                db.add(BusinessDomainModule(
                    domain_code=code,
                    module_id=master_mod.id,
                    is_primary=m.is_primary,
                ))
        db.commit()
        return {"success": True, "message": f"Domínio '{code}' criado com sucesso."}
    except HTTPException:
        raise
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
            from app.models.knowledge import ProtheusModuleMaster
            db.query(BusinessDomainModule).filter(BusinessDomainModule.domain_code == domain.domain_code).delete()
            for m in payload.modules:
                mod_sigla_upper = m.mod_sigla.strip().upper()
                master_mod = db.query(ProtheusModuleMaster).filter(
                    ProtheusModuleMaster.id == m.mod_code,
                    ProtheusModuleMaster.module_sigla == mod_sigla_upper
                ).first()
                if not master_mod:
                    db.rollback()
                    raise HTTPException(status_code=400, detail=f"Módulo '{mod_sigla_upper}' com código '{m.mod_code}' não existe no catálogo master.")
                    
                db.add(BusinessDomainModule(
                    domain_code=domain.domain_code,
                    module_id=master_mod.id,
                    is_primary=m.is_primary,
                ))
        db.commit()
        return {"success": True, "message": f"Domínio '{domain.domain_code}' atualizado."}
    except HTTPException:
        raise
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


# ── 6. REGRAS DE NEGÓCIO (NOVA ESTRUTURA NORMALIZADA MULTI-TENANT) ────────

def _ensure_tenant_business_rule_tables(db: Session, clean_tenant: str):
    """Garante que o schema do tenant contenha todas as tabelas normalizadas de regras de negócio."""
    try:
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_rules (
                id bigserial PRIMARY KEY,
                intent_code varchar(100) NOT NULL DEFAULT 'GLOBAL',
                rule_type varchar(100) NOT NULL,
                rule_json jsonb NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_rule_sets (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_set_code varchar(100) NOT NULL UNIQUE,
                name varchar(160) NOT NULL,
                status varchar(24) NOT NULL DEFAULT 'ACTIVE',
                version integer NOT NULL DEFAULT 1,
                valid_from timestamptz,
                valid_to timestamptz,
                created_by uuid,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_rule_tes (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_set_id uuid NOT NULL REFERENCES "{clean_tenant}".business_rule_sets(id) ON DELETE CASCADE,
                tes_code varchar(16) NOT NULL,
                direction varchar(16) NOT NULL,
                classification_code varchar(64) NOT NULL,
                affects_gross_revenue boolean NOT NULL DEFAULT false,
                affects_net_revenue boolean NOT NULL DEFAULT false,
                affects_abc boolean NOT NULL DEFAULT false,
                revenue_effect varchar(16) NOT NULL DEFAULT 'IGNORE',
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE(rule_set_id, tes_code, direction)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_cfop_rules (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_set_id uuid NOT NULL REFERENCES "{clean_tenant}".business_rule_sets(id) ON DELETE CASCADE,
                cfop_code varchar(16) NOT NULL,
                classification_code varchar(64) NOT NULL,
                operation_type varchar(32),
                affects_revenue boolean NOT NULL DEFAULT false,
                affects_inventory boolean NOT NULL DEFAULT false,
                affects_tax boolean NOT NULL DEFAULT false,
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE(rule_set_id, cfop_code)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_financial_natures (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_set_id uuid NOT NULL REFERENCES "{clean_tenant}".business_rule_sets(id) ON DELETE CASCADE,
                nature_code varchar(64) NOT NULL,
                nature_name varchar(200),
                financial_group varchar(64) NOT NULL,
                cashflow_type varchar(32),
                affects_result boolean NOT NULL DEFAULT true,
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE(rule_set_id, nature_code)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_revenue_configs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id uuid,
                included_classifications jsonb NOT NULL DEFAULT '[]'::jsonb,
                excluded_classifications jsonb NOT NULL DEFAULT '[]'::jsonb,
                version integer NOT NULL DEFAULT 1,
                active boolean NOT NULL DEFAULT true,
                created_by uuid,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE NULLS NOT DISTINCT(company_id, version)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_receivable_configs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id uuid,
                overdue_days integer NOT NULL DEFAULT 30,
                include_renegotiated boolean NOT NULL DEFAULT false,
                include_provisional boolean NOT NULL DEFAULT false,
                version integer NOT NULL DEFAULT 1,
                active boolean NOT NULL DEFAULT true,
                created_by uuid,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE NULLS NOT DISTINCT(company_id, version)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_inventory_configs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id uuid,
                stock_idle_days integer NOT NULL DEFAULT 90,
                stock_critical_days integer NOT NULL DEFAULT 7,
                stock_rupture_days integer NOT NULL DEFAULT 0,
                version integer NOT NULL DEFAULT 1,
                active boolean NOT NULL DEFAULT true,
                created_by uuid,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE NULLS NOT DISTINCT(company_id, version)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_abc_configs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id uuid,
                class_a_pct numeric(5,2) NOT NULL DEFAULT 70.00,
                class_b_pct numeric(5,2) NOT NULL DEFAULT 20.00,
                class_c_pct numeric(5,2) NOT NULL DEFAULT 10.00,
                version integer NOT NULL DEFAULT 1,
                active boolean NOT NULL DEFAULT true,
                created_by uuid,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE NULLS NOT DISTINCT(company_id, version)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".business_synonyms (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                source_term varchar(100) NOT NULL,
                target_term varchar(100) NOT NULL,
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE(source_term, target_term)
            );
        """))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Aviso ao garantir tabelas de regras no tenant {clean_tenant}: {exc}")


def _get_or_create_default_rule_set(db: Session, clean_tenant: str) -> str:
    """Retorna o ID do conjunto de regras ativo padrão do tenant, criando-o se não existir."""
    row = db.execute(text(f"""
        SELECT id FROM "{clean_tenant}".business_rule_sets
        WHERE status = 'ACTIVE'
        ORDER BY version DESC, created_at ASC
        LIMIT 1
    """)).first()
    if row:
        return str(row[0])
    
    rs_id = db.execute(text(f"""
        INSERT INTO "{clean_tenant}".business_rule_sets (rule_set_code, name, status, version)
        VALUES ('DEFAULT', 'Regras Padrão de Negócio', 'ACTIVE', 1)
        RETURNING id
    """)).scalar()
    db.commit()
    return str(rs_id)


@router.get("/business-rules")
def list_business_rules(
    tenant_id: str,
    intent_code: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        _ensure_tenant_business_rule_tables(db, clean_tenant)

        all_rules: List[Dict[str, Any]] = []

        # 1. TES Rules (business_rule_tes)
        try:
            tes_rows = db.execute(text(f"""
                SELECT id, tes_code, direction, classification_code,
                       affects_gross_revenue, affects_net_revenue, affects_abc,
                       revenue_effect, active, created_at
                FROM "{clean_tenant}".business_rule_tes
                ORDER BY tes_code
            """)).mappings().all()

            for r in tes_rows:
                direction_str = "saida" if str(r["direction"]).upper() in ("OUTBOUND", "SAIDA") else "entrada"
                rule_type = "tes_saida" if direction_str == "saida" else "tes_entrada"
                rule_json = {
                    "id": str(r["id"]),
                    "tes": r["tes_code"],
                    "direction": direction_str,
                    "classification": r["classification_code"],
                    "description": "",
                    "affects_gross_revenue": bool(r["affects_gross_revenue"]),
                    "affects_net_revenue": bool(r["affects_net_revenue"]),
                    "affects_abc": bool(r["affects_abc"]),
                    "revenue_effect": r["revenue_effect"],
                    "status": "Ativo" if r["active"] else "Inativo",
                    "active": bool(r["active"]),
                }
                all_rules.append({
                    "id": str(r["id"]),
                    "intent_code": "GLOBAL",
                    "rule_type": rule_type,
                    "rule_json": rule_json,
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                })
        except Exception as e:
            logger.warning(f"Aviso ao ler business_rule_tes para {clean_tenant}: {e}")

        # 2. CFOP Rules (business_cfop_rules)
        try:
            cfop_rows = db.execute(text(f"""
                SELECT id, cfop_code, classification_code, operation_type,
                       affects_revenue, affects_inventory, affects_tax, active, created_at
                FROM "{clean_tenant}".business_cfop_rules
                ORDER BY cfop_code
            """)).mappings().all()

            for r in cfop_rows:
                rule_json = {
                    "id": str(r["id"]),
                    "cfop": r["cfop_code"],
                    "classification": r["classification_code"],
                    "operation_type": r["operation_type"],
                    "affects_revenue": bool(r["affects_revenue"]),
                    "affects_inventory": bool(r["affects_inventory"]),
                    "affects_tax": bool(r["affects_tax"]),
                    "active": bool(r["active"]),
                }
                all_rules.append({
                    "id": str(r["id"]),
                    "intent_code": "GLOBAL",
                    "rule_type": rule_type if False else "cfop",
                    "rule_json": rule_json,
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                })
        except Exception as e:
            logger.warning(f"Aviso ao ler business_cfop_rules para {clean_tenant}: {e}")

        # 3. Naturezas Financeiras (business_financial_natures)
        try:
            nat_rows = db.execute(text(f"""
                SELECT id, nature_code, nature_name, financial_group, cashflow_type,
                       affects_result, active, created_at
                FROM "{clean_tenant}".business_financial_natures
                ORDER BY nature_code
            """)).mappings().all()

            for r in nat_rows:
                rule_json = {
                    "id": str(r["id"]),
                    "nature_code": r["nature_code"],
                    "nature_name": r["nature_name"] or "",
                    "financial_group": r["financial_group"],
                    "cashflow_type": r["cashflow_type"],
                    "affects_result": bool(r["affects_result"]),
                    "active": bool(r["active"]),
                }
                all_rules.append({
                    "id": str(r["id"]),
                    "intent_code": "GLOBAL",
                    "rule_type": "natureza_financeira",
                    "rule_json": rule_json,
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                })
        except Exception as e:
            logger.warning(f"Aviso ao ler business_financial_natures para {clean_tenant}: {e}")

        # 4. Configurações Globais (business_revenue_configs, etc.)
        try:
            rev_row = db.execute(text(f"""
                SELECT included_classifications, excluded_classifications, updated_at
                FROM "{clean_tenant}".business_revenue_configs
                WHERE active = TRUE
                ORDER BY version DESC, updated_at DESC LIMIT 1
            """)).mappings().first()

            rec_row = db.execute(text(f"""
                SELECT overdue_days, include_renegotiated, include_provisional, updated_at
                FROM "{clean_tenant}".business_receivable_configs
                WHERE active = TRUE
                ORDER BY version DESC, updated_at DESC LIMIT 1
            """)).mappings().first()

            inv_row = db.execute(text(f"""
                SELECT stock_idle_days, stock_critical_days, stock_rupture_days, updated_at
                FROM "{clean_tenant}".business_inventory_configs
                WHERE active = TRUE
                ORDER BY version DESC, updated_at DESC LIMIT 1
            """)).mappings().first()

            abc_row = db.execute(text(f"""
                SELECT class_a_pct, class_b_pct, class_c_pct, updated_at
                FROM "{clean_tenant}".business_abc_configs
                WHERE active = TRUE
                ORDER BY version DESC, updated_at DESC LIMIT 1
            """)).mappings().first()

            has_explicit = bool(rev_row or rec_row or inv_row or abc_row)
            config_json = {
                "billing_included_classifications": rev_row["included_classifications"] if rev_row else ["VENDA", "EXPORTACAO"],
                "billing_excluded_classifications": rev_row["excluded_classifications"] if rev_row else ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"],
                "receivables_overdue_days": rec_row["overdue_days"] if rec_row else 30,
                "receivables_include_renegotiated": bool(rec_row["include_renegotiated"]) if rec_row else False,
                "receivables_include_provisional": bool(rec_row["include_provisional"]) if rec_row else True,
                "stock_idle_days": inv_row["stock_idle_days"] if inv_row else 90,
                "stock_critical_days": inv_row["stock_critical_days"] if inv_row else 7,
                "stock_rupture_days": inv_row["stock_rupture_days"] if inv_row else 0,
                "abc_curve_a_pct": float(abc_row["class_a_pct"]) if abc_row else 80.0,
                "abc_curve_b_pct": float(abc_row["class_b_pct"]) if abc_row else 15.0,
                "abc_curve_c_pct": float(abc_row["class_c_pct"]) if abc_row else 5.0,
                "ai_cash_flow_tables": ["SE1", "SE2", "SE5"],
                "_source": "EXPLICIT" if has_explicit else "DEFAULT",
            }
            all_rules.append({
                "id": "config",
                "intent_code": "GLOBAL",
                "rule_type": "config",
                "rule_json": config_json,
                "created_at": None,
            })
        except Exception as e:
            logger.warning(f"Aviso ao ler configs de regras para {clean_tenant}: {e}")

        # 5. Tabela genérica business_rules (se houver regras customizadas salvas)
        try:
            scope = "WHERE intent_code = :icode" if intent_code else ""
            params = {"icode": intent_code.strip().lower()} if intent_code else {}
            br_rows = db.execute(text(f"""
                SELECT id, intent_code, rule_type, rule_json, created_at
                FROM "{clean_tenant}".business_rules
                {scope}
                ORDER BY intent_code, rule_type
            """), params).mappings().all()
            for r in br_rows:
                if r["rule_type"] not in ("tes_saida", "tes_entrada", "cfop", "natureza_financeira", "config"):
                    all_rules.append({
                        "id": str(r["id"]),
                        "intent_code": r["intent_code"],
                        "rule_type": r["rule_type"],
                        "rule_json": r["rule_json"] if isinstance(r["rule_json"], dict) else json.loads(r["rule_json"]),
                        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    })
        except Exception as e:
            logger.warning(f"Aviso ao ler business_rules legada para {clean_tenant}: {e}")

        if intent_code:
            all_rules = [r for r in all_rules if r.get("intent_code", "").lower() == intent_code.strip().lower() or r.get("intent_code") == "GLOBAL"]

        return all_rules
    except Exception as exc:
        logger.exception("Erro ao listar regras de negócio")
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/business-rules", status_code=status.HTTP_201_CREATED)
def create_business_rule(
    payload: BusinessRuleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, payload.tenant_id)
        _ensure_tenant_business_rule_tables(db, clean_tenant)
        rule_set_id = _get_or_create_default_rule_set(db, clean_tenant)

        rtype = payload.rule_type.strip().lower()
        rjson = payload.rule_json or {}

        if rtype in ("tes_saida", "tes_entrada"):
            tes_code = str(rjson.get("tes", "")).strip().upper()
            direction = "OUTBOUND" if (rtype == "tes_saida" or rjson.get("direction") == "saida") else "INBOUND"
            classification = str(rjson.get("classification", "")).strip().upper()
            affects_gross = classification in ("VENDA", "EXPORTACAO")
            affects_net = classification in ("VENDA", "EXPORTACAO")
            affects_abc = classification in ("VENDA", "EXPORTACAO")
            revenue_effect = "ADD" if classification in ("VENDA", "EXPORTACAO") else ("SUBTRACT" if classification == "DEVOLUCAO" else "IGNORE")

            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_rule_tes
                    (rule_set_id, tes_code, direction, classification_code,
                     affects_gross_revenue, affects_net_revenue, affects_abc,
                     revenue_effect, active)
                VALUES
                    (:rsid, :tes, :direction, :cls, :gross, :net, :abc, :reveff, true)
                ON CONFLICT (rule_set_id, tes_code, direction)
                DO UPDATE SET
                    classification_code = EXCLUDED.classification_code,
                    affects_gross_revenue = EXCLUDED.affects_gross_revenue,
                    affects_net_revenue = EXCLUDED.affects_net_revenue,
                    affects_abc = EXCLUDED.affects_abc,
                    revenue_effect = EXCLUDED.revenue_effect,
                    active = true,
                    updated_at = now()
            """), {
                "rsid": rule_set_id,
                "tes": tes_code,
                "direction": direction,
                "cls": classification,
                "gross": affects_gross,
                "net": affects_net,
                "abc": affects_abc,
                "reveff": revenue_effect,
            })

        elif rtype == "cfop":
            cfop_code = str(rjson.get("cfop", "")).strip().upper()
            classification = str(rjson.get("classification", "")).strip().upper()

            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_cfop_rules
                    (rule_set_id, cfop_code, classification_code, active)
                VALUES
                    (:rsid, :cfop, :cls, true)
                ON CONFLICT (rule_set_id, cfop_code)
                DO UPDATE SET
                    classification_code = EXCLUDED.classification_code,
                    active = true,
                    updated_at = now()
            """), {
                "rsid": rule_set_id,
                "cfop": cfop_code,
                "cls": classification,
            })

        elif rtype == "natureza_financeira":
            nature_code = str(rjson.get("nature_code", "")).strip().upper()
            nature_name = str(rjson.get("nature_name", "")).strip()
            financial_group = str(rjson.get("financial_group", "")).strip().upper()

            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_financial_natures
                    (rule_set_id, nature_code, nature_name, financial_group, active)
                VALUES
                    (:rsid, :ncode, :nname, :fgroup, true)
                ON CONFLICT (rule_set_id, nature_code)
                DO UPDATE SET
                    nature_name = EXCLUDED.nature_name,
                    financial_group = EXCLUDED.financial_group,
                    active = true,
                    updated_at = now()
            """), {
                "rsid": rule_set_id,
                "ncode": nature_code,
                "nname": nature_name,
                "fgroup": financial_group,
            })

        elif rtype == "config":
            company_id = db.execute(text(f'SELECT id FROM "{clean_tenant}".companies LIMIT 1')).scalar()

            inc_cls = rjson.get("billing_included_classifications", ["VENDA", "EXPORTACAO"])
            exc_cls = rjson.get("billing_excluded_classifications", ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"])
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_revenue_configs
                    (company_id, included_classifications, excluded_classifications, active)
                VALUES
                    (:cid, CAST(:inc AS jsonb), CAST(:exc AS jsonb), true)
                ON CONFLICT (company_id, version)
                DO UPDATE SET
                    included_classifications = EXCLUDED.included_classifications,
                    excluded_classifications = EXCLUDED.excluded_classifications,
                    updated_at = now()
            """), {"cid": company_id, "inc": json.dumps(inc_cls), "exc": json.dumps(exc_cls)})

            odays = int(rjson.get("receivables_overdue_days", 30))
            reneg = bool(rjson.get("receivables_include_renegotiated", False))
            prov = bool(rjson.get("receivables_include_provisional", True))
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_receivable_configs
                    (company_id, overdue_days, include_renegotiated, include_provisional, active)
                VALUES
                    (:cid, :odays, :reneg, :prov, true)
                ON CONFLICT (company_id, version)
                DO UPDATE SET
                    overdue_days = EXCLUDED.overdue_days,
                    include_renegotiated = EXCLUDED.include_renegotiated,
                    include_provisional = EXCLUDED.include_provisional,
                    updated_at = now()
            """), {"cid": company_id, "odays": odays, "reneg": reneg, "prov": prov})

            idle = int(rjson.get("stock_idle_days", 90))
            crit = int(rjson.get("stock_critical_days", 7))
            rupt = int(rjson.get("stock_rupture_days", 0))
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_inventory_configs
                    (company_id, stock_idle_days, stock_critical_days, stock_rupture_days, active)
                VALUES
                    (:cid, :idle, :crit, :rupt, true)
                ON CONFLICT (company_id, version)
                DO UPDATE SET
                    stock_idle_days = EXCLUDED.stock_idle_days,
                    stock_critical_days = EXCLUDED.stock_critical_days,
                    stock_rupture_days = EXCLUDED.stock_rupture_days,
                    updated_at = now()
            """), {"cid": company_id, "idle": idle, "crit": crit, "rupt": rupt})

            ca = float(rjson.get("abc_curve_a_pct", 80.0))
            cb = float(rjson.get("abc_curve_b_pct", 15.0))
            cc = float(rjson.get("abc_curve_c_pct", 5.0))
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".business_abc_configs
                    (company_id, class_a_pct, class_b_pct, class_c_pct, active)
                VALUES
                    (:cid, :ca, :cb, :cc, true)
                ON CONFLICT (company_id, version)
                DO UPDATE SET
                    class_a_pct = EXCLUDED.class_a_pct,
                    class_b_pct = EXCLUDED.class_b_pct,
                    class_c_pct = EXCLUDED.class_c_pct,
                    updated_at = now()
            """), {"cid": company_id, "ca": ca, "cb": cb, "cc": cc})

        # Registra também na tabela genérica business_rules para histórico e compatibilidade
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
        logger.exception("Erro ao salvar regra de negócio")
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/business-rules/{rule_id}")
def delete_business_rule(
    rule_id: str,
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        _ensure_tenant_business_rule_tables(db, clean_tenant)

        # Deleta em todas as tabelas potenciais pelo id (UUID ou serial)
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".business_rule_tes WHERE id::text = :id'), {"id": rule_id})
        except Exception:
            pass
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".business_cfop_rules WHERE id::text = :id'), {"id": rule_id})
        except Exception:
            pass
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".business_financial_natures WHERE id::text = :id'), {"id": rule_id})
        except Exception:
            pass
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".business_synonyms WHERE id::text = :id'), {"id": rule_id})
        except Exception:
            pass
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".business_rules WHERE id::text = :id'), {"id": rule_id})
        except Exception:
            pass

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

@router.put("/semantic-dictionary/{alias_id}")
def update_field_alias(alias_id: int, payload: FieldAliasCreateUpdate, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    authorize_admin_access(admin, "governance:write", payload.tenant_id)
    
    # Needs tenant resolver
    from app.services.tenant_resolver import set_tenant_context
    from app.models.business_knowledge import BusinessFieldAlias
    
    set_tenant_context(db, payload.tenant_id)
    alias = db.query(BusinessFieldAlias).filter(BusinessFieldAlias.id == alias_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias nao encontrado no tenant informado")
        
    alias.field_name = payload.field_name
    alias.business_name = payload.business_name
    alias.field_format = payload.field_format
    alias.field_description = payload.field_description
    alias.synonyms = payload.synonyms
    
    db.commit()
    db.refresh(alias)
    return alias
