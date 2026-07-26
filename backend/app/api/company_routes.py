from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import uuid
import json
import jwt

from app.db.database import get_db
from app.models.knowledge import (
    Company, LicensePlan, AgentQueryAudit,
    ProtheusModuleMaster, TenantModuleContract, TenantContract
)
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    LicenseGenerateRequest, LicenseVerifyRequest, SessionValidateRequest
)
from app.schemas.company_modules import (
    CompanyListResponse,
    CompanyModulesAssignedResponse,
    CompanyModulesAvailableResponse,
    CompanyModulesSaveRequest,
    CompanyModulesSaveResponse,
    CompanyModulesSyncRequest,
    CompanyModulesSyncResponse,
)
from app.services.company_module_service import (
    get_company_or_404,
    get_enabled_modules,
    list_companies,
    list_company_modules,
    preload_allowed_tables_from_dictionary,
    replace_company_modules,
)
from app.services.license_service import generate_license, verify_license
from app.services.queryrest_service import queryrest_exec, queryrest_exec_tenant
from app.services.sync_dictionary_v52 import run_snapshot
from app.core.config import settings
from app.core.security import encrypt_password

logger = logging.getLogger("app.api.company_routes")

router = APIRouter(tags=["companies"])


def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado. Admin key inválida ou ausente."
        )
    return x_admin_key


# ─────────────────────────────────────────────────────────────
# MÓDULOS DA EMPRESA (Multi-Tenant & RBAC Curado via Pydantic & Service)
# ─────────────────────────────────────────────────────────────

@router.get("/companies/list", response_model=CompanyListResponse)
def get_companies_list(
    tenant_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    items = list_companies(db, tenant_id=tenant_id)
    return {
        "status": "success",
        "items": items,
    }


@router.get("/companies/{company_id}/modules/available", response_model=CompanyModulesAvailableResponse)
async def get_available_modules(
    company_id: int,
    db: Session = Depends(get_db),
):
    company = get_company_or_404(db, company_id)

    sql = """
        SELECT DISTINCT
            USR_MODULO,
            USR_CODMOD
        FROM SYS_USR_MODULE
        WHERE D_E_L_E_T_ <> '*'
        ORDER BY USR_MODULO
    """

    try:
        if company.get("protheus_rest_url") and company.get("protheus_usuario") and company.get("encrypted_protheus_password"):
            rows = queryrest_exec(
                company["protheus_rest_url"],
                company["protheus_usuario"],
                company["encrypted_protheus_password"],
                sql
            )
        else:
            rows = await queryrest_exec_tenant(
                db=db,
                tenant_id=company["tenant_id"],
                company_id=company_id,
                query=sql
            )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao consultar módulos disponíveis no Protheus: {str(e)}"
        )

    items = []
    seen = set()

    for row in rows:
        module_code = (row.get("USR_CODMOD") or "").strip().upper()
        module_name = (row.get("USR_MODULO") or "").strip()

        if not module_code or not module_name:
            continue

        if module_code in seen:
            continue

        seen.add(module_code)
        items.append({
            "module_code": module_code,
            "module_name": module_name,
        })

    return {
        "status": "success",
        "company_id": company_id,
        "items": items,
    }


@router.get("/companies/{company_id}/modules", response_model=CompanyModulesAssignedResponse)
def get_modules_by_company(
    company_id: int,
    db: Session = Depends(get_db),
):
    company = get_company_or_404(db, company_id)

    items = list_company_modules(
        db=db,
        company_id=company_id,
        tenant_id=company["tenant_id"],
    )

    return {
        "status": "success",
        "company_id": company_id,
        "items": items,
    }


@router.post("/companies/{company_id}/modules", response_model=CompanyModulesSaveResponse)
def save_modules_by_company(
    company_id: int,
    payload: CompanyModulesSaveRequest,
    db: Session = Depends(get_db),
):
    company = get_company_or_404(db, company_id)

    modules_saved = replace_company_modules(
        db=db,
        company_id=company_id,
        tenant_id=company["tenant_id"],
        payload=payload,
    )

    return {
        "status": "success",
        "company_id": company_id,
        "modules_saved": modules_saved,
    }


@router.post("/companies/{company_id}/modules/sync", response_model=CompanyModulesSyncResponse)
def sync_modules_dictionary(
    company_id: int,
    payload: CompanyModulesSyncRequest,
    db: Session = Depends(get_db),
):
    company = get_company_or_404(db, company_id)

    module_filter = get_enabled_modules(
        db=db,
        company_id=company_id,
        tenant_id=company["tenant_id"],
    )

    if not module_filter:
        raise HTTPException(
            status_code=400,
            detail="Nenhum módulo habilitado para sincronização"
        )

    try:
        snapshot_result = run_snapshot(
            tenant_id=company["tenant_id"],
            environment_id=company.get("protheus_ambientes") or "producao",
            company_id=str(company_id),
            session=db,
            module_filter=module_filter,
            rest_url=company.get("protheus_rest_url"),
            protheus_user=company.get("protheus_usuario"),
            encrypted_password=company.get("encrypted_protheus_password"),
        )
        if not isinstance(snapshot_result, dict):
            snapshot_result = {"result": str(snapshot_result), "status": "completed"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao sincronizar dicionário por módulos: {str(e)}"
        )

    if not payload.force_full_reload:
        try:
            preload_allowed_tables_from_dictionary(
                db=db,
                company_id=company_id,
                tenant_id=company["tenant_id"],
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Snapshot concluído, mas falhou a carga de tabelas permitidas: {str(e)}"
            )

    return {
        "status": "success",
        "company_id": company_id,
        "module_filter": module_filter,
        "snapshot_result": snapshot_result,
    }


# ─────────────────────────────────────────────────────────────
# CRUD Empresas & Billing & Licenciamento (Legado/Padrão)
# ─────────────────────────────────────────────────────────────

@router.get("/companies", response_model=List[CompanyResponse])
def list_all_companies(tenant_id: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(Company)
    if tenant_id:
        q = q.filter(Company.tenant_id == tenant_id)
    return q.order_by(Company.id.asc()).all()


@router.get("/companies/by-tenant/{tenant_id}", response_model=CompanyResponse)
def get_company_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    comp = db.query(Company).filter(Company.tenant_id == tenant_id).first()
    if not comp:
        comp = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Empresa não encontrada para o tenant.")
    return comp


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
