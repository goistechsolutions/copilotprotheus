from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import (
    Company, LicensePlan, AgentQueryAudit,
    ProtheusModuleMaster, TenantModuleContract, TenantContract
)
from sqlalchemy import func
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse, LicenseGenerateRequest, LicenseVerifyRequest, SessionValidateRequest
from app.services.license_service import generate_license, verify_license
from app.services.queryrest_service import queryrest_exec
from app.services.sync_dictionary_v52 import run_snapshot
from app.core.config import settings
from typing import List, Optional
from datetime import datetime
import uuid
import jwt
from app.core.security import encrypt_password
from pydantic import BaseModel

router = APIRouter(tags=["companies"])


class SaveModulesRequest(BaseModel):
    modules: List[dict]           # [{"USR_CODMOD": "FAT", "USR_MODULO": "SIGAFAT"}, ...]
    contract_id: Optional[str] = None
    trigger_snapshot: bool = True


def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado. Admin key inválida ou ausente."
        )
    return x_admin_key


# ─────────────────────────────────────────────────────────────
# CRUD Empresas (existente — sem alteração)
# ─────────────────────────────────────────────────────────────

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).order_by(Company.id.asc()).all()


@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return comp


@router.post("/companies", response_model=CompanyResponse)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(Company.cnpj == payload.cnpj).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma empresa cadastrada com este CNPJ.")
    if payload.tenant_id == "":
        payload.tenant_id = None
    if payload.protheus_password:
        payload.protheus_password = encrypt_password(payload.protheus_password)
    comp = Company(**payload.model_dump())
    db.add(comp)
    try:
        db.commit()
        db.refresh(comp)
        return comp
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro no Banco de Dados: {str(e)}")


@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    if payload.tenant_id == "":
        payload.tenant_id = None
    update_data = payload.model_dump(exclude_unset=True)
    if "protheus_password" in update_data and update_data["protheus_password"]:
        update_data["protheus_password"] = encrypt_password(update_data["protheus_password"])
    for k, v in update_data.items():
        setattr(comp, k, v)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    db.delete(comp)
    db.commit()
    return {"message": "Empresa excluída com sucesso."}


@router.post("/license/generate")
def api_generate_license(payload: LicenseGenerateRequest, admin_key: str = Depends(verify_admin_key)):
    try:
        token = generate_license(
            cnpj=payload.cnpj,
            expiration_date=payload.expiration_date,
            plan_level=payload.plan_level
        )
        return {"token": token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao gerar licença: {str(e)}")


@router.get("/companies/{company_id}/billing")
def get_company_billing(company_id: int, db: Session = Depends(get_db)):
    usage = db.query(
        func.count(AgentQueryAudit.id).label("total_queries")
    ).filter(AgentQueryAudit.company_id == company_id).first()
    return {
        "company_id": company_id,
        "total_queries": usage.total_queries or 0,
        "note": "Billing V4: baseado em AgentQueryAudit."
    }


@router.post("/license/verify")
def api_verify_license(payload: LicenseVerifyRequest):
    try:
        info = verify_license(payload.token, expected_cnpj=payload.cnpj)
        exp_dt = datetime.fromtimestamp(info["exp"])
        info["expiration_date_formatted"] = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
        info["is_expired"] = exp_dt < datetime.now()
        info["valid"] = True
        return info
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "A licença expirou.", "is_expired": True}
    except Exception as e:
        return {"valid": False, "error": f"Licença inválida: {str(e)}", "is_expired": False}


@router.get("/companies/by-tenant/{tenant_id}", response_model=CompanyResponse)
def get_company_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.tenant_id == tenant_id).first()
    if not comp:
        comp = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada para o tenant.")
    return comp


# ─────────────────────────────────────────────────────────────
# MÓDULOS DA EMPRESA (novo — v5.3)
# ─────────────────────────────────────────────────────────────

@router.get("/companies/{company_id}/modules/available")
def get_available_modules(company_id: int, db: Session = Depends(get_db)):
    """
    Busca módulos instalados no Protheus da empresa via SYS_USR_MODULE.
    Executa a consulta diretamente na QueryRest da empresa.
    """
    comp = _get_company_or_404(company_id, db)
    _check_rest_config(comp)

    sql = (
        "SELECT ROW_NUMBER() OVER (ORDER BY USR_MODULO) AS ID, "
        "USR_MODULO, USR_CODMOD "
        "FROM (SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE)"
    )

    try:
        rows = queryrest_exec(
            comp.protheus_rest_url,
            comp.protheus_usuario,
            comp.encrypted_protheus_password,
            sql,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "company_id": company_id,
        "tenant_id": comp.tenant_id,
        "total": len(rows),
        "modules": rows,
    }


@router.get("/companies/{company_id}/modules")
def get_company_modules(company_id: int, db: Session = Depends(get_db)):
    """
    Lista os módulos já selecionados/salvos para a empresa.
    """
    comp = _get_company_or_404(company_id, db)

    rows = (
        db.query(TenantModuleContract, ProtheusModuleMaster)
        .join(ProtheusModuleMaster, TenantModuleContract.module_id == ProtheusModuleMaster.id)
        .filter(TenantModuleContract.tenant_id == comp.tenant_id)
        .all()
    )

    return {
        "company_id": company_id,
        "tenant_id": comp.tenant_id,
        "total": len(rows),
        "modules": [
            {
                "module_code": m.module_code,
                "module_name": m.module_name,
                "status": c.status,
            }
            for c, m in rows
        ],
    }


@router.post("/companies/{company_id}/modules")
def save_company_modules(
    company_id: int,
    payload: SaveModulesRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Salva os módulos selecionados para a empresa e,
    opcionalmente, dispara snapshot curado do dicionário.

    Body:
    {
        "modules": [{"USR_CODMOD": "FAT", "USR_MODULO": "SIGAFAT"}, ...],
        "contract_id": "uuid-do-contrato",   // opcional
        "trigger_snapshot": true              // default true
    }
    """
    comp = _get_company_or_404(company_id, db)

    if not payload.modules:
        raise HTTPException(status_code=400, detail="Nenhum módulo informado.")

    # Resolve contrato ativo se não informado
    contract_id = payload.contract_id
    if not contract_id and comp.tenant_id:
        contract = (
            db.query(TenantContract)
            .filter(
                TenantContract.tenant_id == comp.tenant_id,
                TenantContract.contract_status == "active",
            )
            .first()
        )
        if contract:
            contract_id = str(contract.id)

    if not contract_id:
        raise HTTPException(
            status_code=400,
            detail="Contrato ativo não encontrado para a empresa. Informe contract_id ou crie um contrato ativo."
        )

    saved_codes = []

    for mod in payload.modules:
        mod_code = str(mod.get("USR_CODMOD") or "").strip().upper()
        mod_name = str(mod.get("USR_MODULO") or mod_code).strip()

        if not mod_code:
            continue

        # Upsert em protheus_modules_master
        master = db.query(ProtheusModuleMaster).filter(
            ProtheusModuleMaster.module_code == mod_code
        ).first()

        if not master:
            master = ProtheusModuleMaster(
                id=uuid.uuid4(),
                module_code=mod_code,
                module_name=mod_name,
            )
            db.add(master)
            db.flush()

        # Upsert em tenant_module_contracts
        existing = db.query(TenantModuleContract).filter(
            TenantModuleContract.tenant_id   == comp.tenant_id,
            TenantModuleContract.module_id   == master.id,
            TenantModuleContract.contract_id == contract_id,
        ).first()

        if not existing:
            db.add(TenantModuleContract(
                id=uuid.uuid4(),
                tenant_id=comp.tenant_id,
                contract_id=contract_id,
                module_id=master.id,
                status="allowed",
            ))

        saved_codes.append(mod_code)

    db.commit()

    # Dispara snapshot curado em background
    if payload.trigger_snapshot and saved_codes:
        _check_rest_config(comp)
        background_tasks.add_task(
            run_snapshot,
            tenant_id=comp.tenant_id,
            environment_id=comp.protheus_ambientes or "producao",
            company_id=str(comp.id),
            module_filter=saved_codes,
            rest_url=comp.protheus_rest_url,
            protheus_user=comp.protheus_usuario,
            encrypted_password=comp.encrypted_protheus_password,
        )

    return {
        "status": "success",
        "company_id": company_id,
        "tenant_id": comp.tenant_id,
        "modules_saved": saved_codes,
        "snapshot_triggered": payload.trigger_snapshot and bool(saved_codes),
        "message": (
            "Módulos salvos. Snapshot curado do dicionário disparado em background."
            if payload.trigger_snapshot
            else "Módulos salvos. Execute o snapshot manualmente quando desejar."
        ),
    }


# ─────────────────────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────────────────────

def _get_company_or_404(company_id: int, db: Session) -> Company:
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return comp


def _check_rest_config(comp: Company):
    if not comp.protheus_rest_url or not comp.protheus_usuario or not comp.encrypted_protheus_password:
        raise HTTPException(
            status_code=400,
            detail="Empresa sem REST URL, usuário ou senha configurados. Configure antes de buscar módulos."
        )
