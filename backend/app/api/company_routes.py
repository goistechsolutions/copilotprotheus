from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import uuid
import json
import jwt
from pydantic import BaseModel

from app.db.database import get_db
from app.models.knowledge import (
    Company, LicensePlan, AgentQueryAudit,
    ProtheusModuleMaster, TenantModuleContract, TenantContract
)
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    LicenseGenerateRequest, LicenseVerifyRequest, SessionValidateRequest
)
from app.services.license_service import generate_license, verify_license
from app.services.queryrest_service import queryrest_exec
from app.services.sync_dictionary_v52 import run_snapshot
from app.core.config import settings
from app.core.security import encrypt_password

logger = logging.getLogger("app.api.company_routes")

router = APIRouter(tags=["companies"])


class SaveModulesRequest(BaseModel):
    modules: List[dict]
    contract_id: Optional[str] = None
    trigger_snapshot: bool = True


def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado. Admin key inválida ou ausente."
        )
    return x_admin_key


def preload_allowed_tables(db: Session, tenant_id: str, company_id: int):
    """
    Deriva o escopo técnico permitido e as permissões granulares no catálogo v5.2
    com base na lista de módulos contratados pela empresa (RBAC e Escopo Curado).
    """
    try:
        db.execute(
            text("""
                INSERT INTO tenant_table_permissions
                    (tenant_id, company_id, environment_id, role_id, table_name, can_list, can_describe, can_query, approved_by, created_at, updated_at)
                SELECT
                    dt.tenant_id,
                    :company_id_str,
                    dt.environment_id,
                    'default',
                    dt.table_name,
                    TRUE,
                    TRUE,
                    TRUE,
                    'module_contract_sync',
                    NOW(),
                    NOW()
                FROM dictionary_tables dt
                INNER JOIN protheus_modules_master pmm
                    ON pmm.module_code = dt.module_code
                INNER JOIN tenant_module_contracts tmc
                    ON tmc.module_id = pmm.id
                   AND tmc.tenant_id = dt.tenant_id
                   AND tmc.status = 'allowed'
                WHERE dt.tenant_id = :tenant_id
                ON CONFLICT (tenant_id, environment_id, role_id, table_name)
                DO UPDATE SET 
                    can_list = TRUE,
                    can_describe = TRUE,
                    can_query = TRUE,
                    updated_at = NOW()
            """),
            {
                "tenant_id": tenant_id,
                "company_id_str": str(company_id)
            }
        )
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(f"Aviso ao derivar tabelas permitidas no escopo v5.2: {e}")


# ─────────────────────────────────────────────────────────────
# CRUD Empresas & Billing & Licenciamento
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
    db.commit()
    db.refresh(comp)
    return comp


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
# MÓDULOS DA EMPRESA (Multi-Tenant, RBAC & Snapshot)
# ─────────────────────────────────────────────────────────────

@router.get("/companies/{company_id}/modules/available")
def get_available_modules(company_id: int, db: Session = Depends(get_db)):
    """
    Busca módulos instalados no Protheus da empresa via SYS_USR_MODULE.
    Executa a consulta diretamente no endpoint /QueryRest da empresa.
    """
    comp = _get_company_or_404(company_id, db)
    _check_rest_config(comp)

    sql = (
        "SELECT ROW_NUMBER() OVER (ORDER BY USR_MODULO) AS ID, "
        "USR_MODULO, USR_CODMOD "
        "FROM (SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE WHERE D_E_L_E_T_ <> '*')"
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
        mod_code = str(mod.get("USR_CODMOD") or mod.get("module_code") or "").strip().upper()
        mod_name = str(mod.get("USR_MODULO") or mod.get("module_name") or mod_code).strip()

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
    if payload.trigger_snapshot and saved_codes and comp.protheus_rest_url:
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

    # Deriva escopo no catálogo RBAC
    if comp.tenant_id:
        preload_allowed_tables(db, comp.tenant_id, company_id)

    return {
        "status": "success",
        "company_id": company_id,
        "tenant_id": comp.tenant_id,
        "modules_saved": saved_codes,
        "snapshot_triggered": payload.trigger_snapshot and bool(saved_codes) and bool(comp.protheus_rest_url),
        "message": (
            "Módulos salvos. Snapshot curado do dicionário disparado em background."
            if (payload.trigger_snapshot and comp.protheus_rest_url)
            else "Módulos salvos. Execute o snapshot manualmente quando desejar."
        ),
    }


@router.post("/companies/{company_id}/modules/sync")
def sync_company_modules_dictionary(
    company_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    comp = _get_company_or_404(company_id, db)
    _check_rest_config(comp)

    rows = (
        db.query(ProtheusModuleMaster.module_code)
        .join(TenantModuleContract, TenantModuleContract.module_id == ProtheusModuleMaster.id)
        .filter(
            TenantModuleContract.tenant_id == comp.tenant_id,
            TenantModuleContract.status == "allowed"
        )
        .all()
    )
    module_filter = [r[0] for r in rows]

    if not module_filter:
        raise HTTPException(status_code=400, detail="Nenhum módulo habilitado para sincronizar para esta empresa.")

    background_tasks.add_task(
        run_snapshot,
        tenant_id=comp.tenant_id,
        environment_id=comp.protheus_ambientes or "producao",
        company_id=str(comp.id),
        module_filter=module_filter,
        rest_url=comp.protheus_rest_url,
        protheus_user=comp.protheus_usuario,
        encrypted_password=comp.encrypted_protheus_password,
    )

    preload_allowed_tables(db, comp.tenant_id, company_id)

    return {
        "status": "success",
        "company_id": company_id,
        "tenant_id": comp.tenant_id,
        "module_filter": module_filter,
        "message": "Snapshot curado do dicionário disparado em background."
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
            detail="Empresa sem REST URL, usuário ou senha configurados. Configure antes de buscar/sincronizar módulos."
        )
