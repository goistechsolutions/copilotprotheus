"""CRUD administrativo de planos, contratos e módulos contratados.

As rotas operam somente sobre metadados e tabelas de controle do Copilot.
Nenhum dado operacional do Protheus é persistido neste módulo.
"""
from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.admin_routes import verify_admin
from app.db.database import get_db
from app.models.knowledge import LicensePlan, ProtheusModuleMaster, Tenant, TenantContract

router = APIRouter()


@router.get("/tenant-options")
def list_tenant_options(db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    """Retorna apenas identificadores estáveis para selects administrativos."""
    tenants = db.query(Tenant).filter(Tenant.status.notin_(["inactive", "deleted"])).order_by(Tenant.tenant_code).all()
    return {"items": [
        {"id": str(tenant.id), "tenant_code": tenant.tenant_code, "tenant_name": tenant.tenant_name, "status": tenant.status}
        for tenant in tenants
    ]}


class PlanPayload(BaseModel):
    plan_code: str = Field(min_length=2, max_length=60, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
    plan_name: str = Field(min_length=2, max_length=150)
    billing_cycle: str = Field(default="monthly", pattern=r"^(monthly|quarterly|annual|one_time)$")
    query_limit: int | None = Field(default=None, ge=0)
    concurrent_sessions_limit: int | None = Field(default=None, ge=1)
    overage_mode: str = Field(default="block", pattern=r"^(block|allow|charge|overage)$")
    active: bool = True


class ContractPayload(BaseModel):
    tenant_id: str = Field(min_length=1, max_length=100)
    plan_id: UUID
    contract_code: str = Field(min_length=2, max_length=80)
    contract_status: str = Field(default="active", pattern=r"^(active|suspended|cancelled|expired|draft)$")
    starts_at: date
    ends_at: date | None = None
    query_limit_override: int | None = Field(default=None, ge=0)
    concurrent_sessions_override: int | None = Field(default=None, ge=1)
    overage_mode_override: str | None = Field(default=None, pattern=r"^(block|allow|charge|overage)$")
    notes: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at não pode ser anterior a starts_at")
        return self


class ContractModulePayload(BaseModel):
    module_ids: list[UUID] = Field(default_factory=list, max_length=500)


def _tenant_or_404(db: Session, tenant_id: str) -> Tenant:
    clean = str(tenant_id or "").strip().lower()
    tenant = db.query(Tenant).filter(Tenant.tenant_code == clean).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado.")
    return tenant


def _plan_or_404(db: Session, plan_id: UUID) -> LicensePlan:
    plan = db.query(LicensePlan).filter(LicensePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return plan


@router.get("/license-plans")
def list_license_plans(db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    plans = db.query(LicensePlan).order_by(LicensePlan.plan_code).all()
    return {"items": [
        {
            "id": str(plan.id), "plan_code": plan.plan_code, "plan_name": plan.plan_name,
            "billing_cycle": plan.billing_cycle, "query_limit": plan.query_limit,
            "concurrent_sessions_limit": plan.concurrent_sessions_limit,
            "overage_mode": plan.overage_mode, "active": plan.active,
            "created_at": plan.created_at, "updated_at": plan.updated_at,
        } for plan in plans
    ]}


@router.post("/license-plans", status_code=status.HTTP_201_CREATED)
def create_license_plan(payload: PlanPayload, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    if db.query(LicensePlan).filter(LicensePlan.plan_code == payload.plan_code).first():
        raise HTTPException(status_code=409, detail="Código de plano já cadastrado.")
    plan = LicensePlan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"success": True, "id": str(plan.id)}


@router.put("/license-plans/{plan_id}")
def update_license_plan(plan_id: UUID, payload: PlanPayload, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    plan = _plan_or_404(db, plan_id)
    conflict = db.query(LicensePlan).filter(LicensePlan.plan_code == payload.plan_code, LicensePlan.id != plan_id).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Código de plano já cadastrado.")
    for key, value in payload.model_dump().items():
        setattr(plan, key, value)
    db.commit()
    return {"success": True}


@router.delete("/license-plans/{plan_id}")
def delete_license_plan(plan_id: UUID, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    plan = _plan_or_404(db, plan_id)
    if db.query(TenantContract).filter(TenantContract.plan_id == plan_id).first():
        raise HTTPException(status_code=409, detail="Plano vinculado a contratos; desative-o em vez de excluí-lo.")
    db.delete(plan)
    db.commit()
    return {"success": True}


@router.get("/contracts")
def list_contracts(tenant_id: str | None = None, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    query = db.query(TenantContract, LicensePlan.plan_code, LicensePlan.plan_name).outerjoin(LicensePlan, LicensePlan.id == TenantContract.plan_id)
    if tenant_id:
        clean = str(tenant_id).strip().lower()
        query = query.filter(TenantContract.tenant_id == clean)
    rows = query.order_by(TenantContract.starts_at.desc()).all()
    return {"items": [
        {
            "id": str(contract.id), "tenant_id": contract.tenant_id, "plan_id": str(contract.plan_id) if contract.plan_id else None,
            "plan_code": plan_code, "plan_name": plan_name, "contract_code": contract.contract_code,
            "contract_status": contract.contract_status, "starts_at": contract.starts_at,
            "ends_at": contract.ends_at, "query_limit_override": contract.query_limit_override,
            "concurrent_sessions_override": contract.concurrent_sessions_override,
            "overage_mode_override": contract.overage_mode_override, "notes": contract.notes,
            "created_at": contract.created_at, "updated_at": contract.updated_at,
        } for contract, plan_code, plan_name in rows
    ]}


@router.post("/contracts", status_code=status.HTTP_201_CREATED)
def create_contract(payload: ContractPayload, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    tenant = _tenant_or_404(db, payload.tenant_id)
    _plan_or_404(db, payload.plan_id)
    if db.query(TenantContract).filter(TenantContract.contract_code == payload.contract_code).first():
        raise HTTPException(status_code=409, detail="Código de contrato já cadastrado.")
    contract = TenantContract(**payload.model_dump(exclude={"tenant_id"}), tenant_id=tenant.tenant_code)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return {"success": True, "id": str(contract.id)}


@router.put("/contracts/{contract_id}")
def update_contract(contract_id: UUID, payload: ContractPayload, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    contract = db.query(TenantContract).filter(TenantContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    tenant = _tenant_or_404(db, payload.tenant_id)
    _plan_or_404(db, payload.plan_id)
    conflict = db.query(TenantContract).filter(TenantContract.contract_code == payload.contract_code, TenantContract.id != contract_id).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Código de contrato já cadastrado.")
    values = payload.model_dump()
    values["tenant_id"] = tenant.tenant_code
    for key, value in values.items():
        setattr(contract, key, value)
    db.commit()
    return {"success": True}


@router.delete("/contracts/{contract_id}")
def delete_contract(contract_id: UUID, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    contract = db.query(TenantContract).filter(TenantContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    linked = db.execute(text("SELECT 1 FROM public.tenant_module_contracts WHERE contract_id = :contract_id LIMIT 1"), {"contract_id": str(contract_id)}).first()
    if linked:
        raise HTTPException(status_code=409, detail="Contrato possui módulos vinculados; suspenda-o em vez de excluí-lo.")
    db.delete(contract)
    db.commit()
    return {"success": True}


@router.get("/contracts/{contract_id}/modules")
def list_contract_modules(contract_id: UUID, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    if not db.query(TenantContract).filter(TenantContract.id == contract_id).first():
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    rows = db.execute(text("""
        SELECT tmc.id, tmc.module_id, tmc.status, pm.mod_code, pm.mod_sigla, pm.mod_name, pm.active
        FROM public.tenant_module_contracts tmc
        JOIN public.protheus_modules_master pm ON pm.id = tmc.module_id
        WHERE tmc.contract_id = :contract_id
        ORDER BY pm.mod_code
    """), {"contract_id": str(contract_id)}).mappings().all()
    return {"items": [dict(row) for row in rows]}


@router.put("/contracts/{contract_id}/modules")
def replace_contract_modules(contract_id: UUID, payload: ContractModulePayload, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    contract = db.query(TenantContract).filter(TenantContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    module_ids = list(dict.fromkeys(str(module_id) for module_id in payload.module_ids))
    if module_ids:
        available = db.query(ProtheusModuleMaster.id).filter(ProtheusModuleMaster.id.in_(payload.module_ids), ProtheusModuleMaster.active.is_(True)).all()
        if len(available) != len(module_ids):
            raise HTTPException(status_code=400, detail="Um ou mais módulos não estão ativos no catálogo global.")
    try:
        db.execute(
            text("DELETE FROM public.tenant_module_contracts WHERE contract_id = CAST(:contract_id AS uuid)"),
            {"contract_id": str(contract_id)},
        )
        for module_id in module_ids:
            # id e created_at são gerados pelos defaults do banco. Isso evita
            # binding de UUID no cliente e mantém a geração centralizada.
            db.execute(text("""
                INSERT INTO public.tenant_module_contracts
                    (tenant_id, contract_id, module_id, status, created_at)
                VALUES
                    (:tenant_id, CAST(:contract_id AS uuid), CAST(:module_id AS uuid), 'active', CURRENT_TIMESTAMP)
            """), {
                "tenant_id": contract.tenant_id,
                "contract_id": str(contract_id),
                "module_id": module_id,
            })
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Falha ao substituir módulos do contrato", extra={"contract_id": str(contract_id)})
        raise HTTPException(status_code=409, detail="Não foi possível atualizar os módulos do contrato; verifique o schema e as constraints do catálogo.") from exc
    return {"success": True, "modules_assigned": len(module_ids)}
