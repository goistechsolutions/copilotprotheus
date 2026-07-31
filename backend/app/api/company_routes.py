from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Dict, Any, List, Optional
import logging
import re
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


from fastapi import Cookie
import os

def verify_admin_key(
    x_admin_key: Optional[str] = Header(None),
    admin_token: Optional[str] = Cookie(None)
):
    # 1. Permite acesso direto para sessões autenticadas no Painel Admin (cookie JWT)
    if admin_token:
        try:
            jwt_secret = os.getenv("ADMIN_JWT_SECRET") or os.getenv("JWT_SECRET", "elitecorp-admin-secret-change-in-prod")
            payload = jwt.decode(admin_token, jwt_secret, algorithms=["HS256"])
            if payload.get("sub") == "admin":
                return "admin"
        except Exception:
            pass

    # 2. Permite acesso via X-Admin-Key header para requisições externas/scripts
    admin_pass = os.getenv("ADMIN_PASSWORD", "")
    jwt_secret = getattr(settings, 'jwt_secret', '') or os.getenv("ADMIN_JWT_SECRET", "") or os.getenv("JWT_SECRET", "")
    if x_admin_key and ((admin_pass and x_admin_key == admin_pass) or (jwt_secret and x_admin_key == jwt_secret)):
        return x_admin_key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Acesso não autorizado. Faça login no painel administrativo."
    )


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

    sql = "SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE ORDER BY USR_MODULO"

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

    import re
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(company.get("tenant_id") or ''))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)

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
    from app.services.company_module_service import list_companies
    return list_companies(db, tenant_id=tenant_id)


@router.get("/companies/by-tenant/{tenant_id}", response_model=CompanyResponse)
def get_company_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    from app.services.company_module_service import get_company_or_404
    return get_company_or_404(db, tenant_id)


@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    from app.services.company_module_service import get_company_or_404
    return get_company_or_404(db, company_id)


def sync_company_into_tenant_schema(db: Session, comp: Company):
    import re
    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    
    tenant_code = str(getattr(comp, 'tenant_id', None) or getattr(comp, 'protheus_grupo', None) or getattr(comp, 'company_code', None) or getattr(comp, 'cnpj', None) or "default")
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_code)
    if not clean_tenant or clean_tenant == "public":
        return

    try:
        ensure_tenant_tables(db, clean_tenant)
        
        c_code = getattr(comp, 'protheus_empresa', None) or getattr(comp, 'company_code', None) or "01"
        b_code = getattr(comp, 'protheus_filial', None) or getattr(comp, 'protheus_branch', None) or "0101"
        c_name = getattr(comp, 'razao_social', None) or getattr(comp, 'company_name', None) or "Empresa"
        c_cnpj = getattr(comp, 'cnpj', None)
        c_ie   = getattr(comp, 'ie', None)
        c_rz   = getattr(comp, 'razao_social', None)
        c_email= getattr(comp, 'email', None)
        c_tel  = getattr(comp, 'telefone', None)
        c_end  = getattr(comp, 'endereco', None)
        c_grp  = getattr(comp, 'protheus_grupo', None)
        c_emp  = getattr(comp, 'protheus_empresa', None)
        c_und  = getattr(comp, 'protheus_unidade', None)
        c_fil  = getattr(comp, 'protheus_filial', None)
        c_env  = getattr(comp, 'protheus_ambientes', None) or getattr(comp, 'protheus_env', None) or "producao"
        c_rest = getattr(comp, 'protheus_rest_url', None) or ""
        c_app  = getattr(comp, 'protheus_webapp_url', None) or ""
        c_user = getattr(comp, 'protheus_usuario', None) or ""
        c_pass = getattr(comp, 'encrypted_protheus_password', None) or ""
        c_status = getattr(comp, 'status', None) or "active"

        upsert_company_info = text(f"""
            INSERT INTO "{clean_tenant}".company_info (
                company_code, branch_code, company_name, cnpj, ie, razao_social, email, telefone, endereco,
                protheus_grupo, protheus_empresa, protheus_unidade, protheus_filial, environment,
                webapp_url, protheus_rest_url, protheus_usuario, encrypted_protheus_password, auth_mode, status
            ) VALUES (
                :c_code, :b_code, :c_name, :c_cnpj, :c_ie, :c_rz, :c_email, :c_tel, :c_end,
                :c_grp, :c_emp, :c_und, :c_fil, :c_env,
                :c_app, :c_rest, :c_user, :c_pass, 'basic', :c_status
            ) ON CONFLICT (company_code, branch_code) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                cnpj = COALESCE(EXCLUDED.cnpj, "{clean_tenant}".company_info.cnpj),
                ie = COALESCE(EXCLUDED.ie, "{clean_tenant}".company_info.ie),
                razao_social = COALESCE(EXCLUDED.razao_social, "{clean_tenant}".company_info.razao_social),
                email = COALESCE(EXCLUDED.email, "{clean_tenant}".company_info.email),
                telefone = COALESCE(EXCLUDED.telefone, "{clean_tenant}".company_info.telefone),
                endereco = COALESCE(EXCLUDED.endereco, "{clean_tenant}".company_info.endereco),
                protheus_grupo = COALESCE(EXCLUDED.protheus_grupo, "{clean_tenant}".company_info.protheus_grupo),
                protheus_empresa = COALESCE(EXCLUDED.protheus_empresa, "{clean_tenant}".company_info.protheus_empresa),
                protheus_unidade = COALESCE(EXCLUDED.protheus_unidade, "{clean_tenant}".company_info.protheus_unidade),
                protheus_filial = COALESCE(EXCLUDED.protheus_filial, "{clean_tenant}".company_info.protheus_filial),
                environment = EXCLUDED.environment,
                webapp_url = EXCLUDED.webapp_url,
                protheus_rest_url = EXCLUDED.protheus_rest_url,
                protheus_usuario = EXCLUDED.protheus_usuario,
                encrypted_protheus_password = EXCLUDED.encrypted_protheus_password,
                status = EXCLUDED.status,
                updated_at = NOW();
        """)
        db.execute(upsert_company_info, {
            "c_code": c_code, "b_code": b_code, "c_name": c_name, "c_cnpj": c_cnpj, "c_ie": c_ie,
            "c_rz": c_rz, "c_email": c_email, "c_tel": c_tel, "c_end": c_end,
            "c_grp": c_grp, "c_emp": c_emp, "c_und": c_und, "c_fil": c_fil, "c_env": c_env,
            "c_app": c_app, "c_rest": c_rest, "c_user": c_user, "c_pass": c_pass, "c_status": c_status
        })
        db.commit()
    except Exception as e:
        logger.error(f"Erro ao provisionar schema/company_info para {clean_tenant}: {e}")
        try: db.rollback()
        except Exception: pass


@router.post("/companies", response_model=CompanyResponse)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    tenant_code = str(payload.tenant_id or payload.protheus_grupo or payload.cnpj or "default")
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_code)
    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)

    enc_pass = None
    if payload.protheus_password:
        enc_pass = encrypt_password(payload.protheus_password)

    c_code = payload.protheus_empresa or "01"
    b_code = payload.protheus_filial or "0101"
    c_name = payload.razao_social
    c_env  = payload.protheus_ambientes or "producao"

    upsert_company_info = text(f"""
        INSERT INTO "{clean_tenant}".company_info (
            tenant_id, company_code, branch_code, company_name, cnpj, ie, razao_social, email, telefone, endereco,
            protheus_grupo, protheus_empresa, protheus_unidade, protheus_filial, environment, protheus_ambientes,
            webapp_url, protheus_rest_url, protheus_usuario, encrypted_protheus_password, auth_mode, status
        ) VALUES (
            :t_id, :c_code, :b_code, :c_name, :cnpj, :ie, :rz, :email, :tel, :end,
            :grp, :emp, :und, :fil, :env, :env,
            :app, :rest, :user, :pass, 'basic', :status
        ) ON CONFLICT (company_code, branch_code) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            company_name = EXCLUDED.company_name,
            cnpj = EXCLUDED.cnpj,
            ie = EXCLUDED.ie,
            razao_social = EXCLUDED.razao_social,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            endereco = EXCLUDED.endereco,
            protheus_grupo = EXCLUDED.protheus_grupo,
            protheus_empresa = EXCLUDED.protheus_empresa,
            protheus_unidade = EXCLUDED.protheus_unidade,
            protheus_filial = EXCLUDED.protheus_filial,
            environment = EXCLUDED.environment,
            protheus_ambientes = EXCLUDED.protheus_ambientes,
            webapp_url = EXCLUDED.webapp_url,
            protheus_rest_url = EXCLUDED.protheus_rest_url,
            protheus_usuario = EXCLUDED.protheus_usuario,
            encrypted_protheus_password = COALESCE(EXCLUDED.encrypted_protheus_password, "{clean_tenant}".company_info.encrypted_protheus_password),
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id, created_at, updated_at;
    """)

    res = db.execute(upsert_company_info, {
        "t_id": clean_tenant, "c_code": c_code, "b_code": b_code, "c_name": c_name, "cnpj": payload.cnpj, "ie": payload.ie,
        "rz": payload.razao_social, "email": payload.email, "tel": payload.telefone, "end": payload.endereco,
        "grp": payload.protheus_grupo, "emp": payload.protheus_empresa, "und": payload.protheus_unidade, "fil": payload.protheus_filial,
        "env": c_env, "app": payload.protheus_webapp_url, "rest": payload.protheus_rest_url, "user": payload.protheus_usuario,
        "pass": enc_pass, "status": payload.status or "ativa"
    }).first()

    upsert_tenant_registry = text("""
        INSERT INTO public.tenant_registry (
            tenant_code, tenant_name, schema_name, status
        ) VALUES (
            :t_code, :c_name, :s_name, 'active'
        ) ON CONFLICT (tenant_code) DO UPDATE SET
            tenant_name = EXCLUDED.tenant_name,
            status = EXCLUDED.status,
            updated_at = NOW();
    """)
    db.execute(upsert_tenant_registry, {
        "t_code": clean_tenant, "c_name": c_name, "s_name": clean_tenant
    })

    db.commit()

    cid = res[0] if res else 1
    now = datetime.now()
    return {
        "id": cid,
        "tenant_id": clean_tenant,
        "cnpj": payload.cnpj,
        "ie": payload.ie,
        "razao_social": payload.razao_social,
        "email": payload.email,
        "telefone": payload.telefone,
        "endereco": payload.endereco,
        "protheus_grupo": payload.protheus_grupo,
        "protheus_empresa": payload.protheus_empresa,
        "protheus_unidade": payload.protheus_unidade,
        "protheus_filial": payload.protheus_filial,
        "protheus_ambientes": payload.protheus_ambientes or "producao",
        "protheus_usuario": payload.protheus_usuario,
        "protheus_rest_url": payload.protheus_rest_url,
        "protheus_webapp_url": payload.protheus_webapp_url,
        "licenca_uso": payload.licenca_uso,
        "status": payload.status or "ativa",
        "created_at": res[1] if res and res[1] else now,
        "updated_at": res[2] if res and res[2] else now
    }


@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    comp_info = get_company_or_404(db, company_id)
    tenant_code = str(payload.tenant_id or comp_info.get("tenant_id") or "default")
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_code)

    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)

    enc_pass = None
    if payload.protheus_password:
        enc_pass = encrypt_password(payload.protheus_password)

    c_code = payload.protheus_empresa or comp_info.get("protheus_empresa") or "01"
    b_code = payload.protheus_filial or comp_info.get("protheus_filial") or "0101"
    c_name = payload.razao_social or comp_info.get("razao_social") or "Empresa"
    c_env  = payload.protheus_ambientes or comp_info.get("protheus_ambientes") or "producao"

    upsert_company_info = text(f"""
        INSERT INTO "{clean_tenant}".company_info (
            tenant_id, company_code, branch_code, company_name, cnpj, ie, razao_social, email, telefone, endereco,
            protheus_grupo, protheus_empresa, protheus_unidade, protheus_filial, environment, protheus_ambientes,
            webapp_url, protheus_rest_url, protheus_usuario, encrypted_protheus_password, auth_mode, status
        ) VALUES (
            :t_id, :c_code, :b_code, :c_name, :cnpj, :ie, :rz, :email, :tel, :end,
            :grp, :emp, :und, :fil, :env, :env,
            :app, :rest, :user, :pass, 'basic', :status
        ) ON CONFLICT (company_code, branch_code) DO UPDATE SET
            tenant_id = COALESCE(EXCLUDED.tenant_id, "{clean_tenant}".company_info.tenant_id),
            company_name = EXCLUDED.company_name,
            cnpj = COALESCE(EXCLUDED.cnpj, "{clean_tenant}".company_info.cnpj),
            ie = COALESCE(EXCLUDED.ie, "{clean_tenant}".company_info.ie),
            razao_social = COALESCE(EXCLUDED.razao_social, "{clean_tenant}".company_info.razao_social),
            email = COALESCE(EXCLUDED.email, "{clean_tenant}".company_info.email),
            telefone = COALESCE(EXCLUDED.telefone, "{clean_tenant}".company_info.telefone),
            endereco = COALESCE(EXCLUDED.endereco, "{clean_tenant}".company_info.endereco),
            protheus_grupo = COALESCE(EXCLUDED.protheus_grupo, "{clean_tenant}".company_info.protheus_grupo),
            protheus_empresa = COALESCE(EXCLUDED.protheus_empresa, "{clean_tenant}".company_info.protheus_empresa),
            protheus_unidade = COALESCE(EXCLUDED.protheus_unidade, "{clean_tenant}".company_info.protheus_unidade),
            protheus_filial = COALESCE(EXCLUDED.protheus_filial, "{clean_tenant}".company_info.protheus_filial),
            environment = EXCLUDED.environment,
            protheus_ambientes = EXCLUDED.protheus_ambientes,
            webapp_url = EXCLUDED.webapp_url,
            protheus_rest_url = EXCLUDED.protheus_rest_url,
            protheus_usuario = EXCLUDED.protheus_usuario,
            encrypted_protheus_password = COALESCE(EXCLUDED.encrypted_protheus_password, "{clean_tenant}".company_info.encrypted_protheus_password),
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id, created_at, updated_at;
    """)

    res = db.execute(upsert_company_info, {
        "t_id": clean_tenant, "c_code": c_code, "b_code": b_code, "c_name": c_name, "cnpj": payload.cnpj, "ie": payload.ie,
        "rz": payload.razao_social, "email": payload.email, "tel": payload.telefone, "end": payload.endereco,
        "grp": payload.protheus_grupo, "emp": payload.protheus_empresa, "und": payload.protheus_unidade, "fil": payload.protheus_filial,
        "env": c_env, "app": payload.protheus_webapp_url, "rest": payload.protheus_rest_url, "user": payload.protheus_usuario,
        "pass": enc_pass, "status": payload.status or "ativa"
    }).first()

    db.commit()

    now = datetime.now()
    return {
        "id": company_id,
        "tenant_id": clean_tenant,
        "cnpj": payload.cnpj or comp_info.get("cnpj", ""),
        "ie": payload.ie or comp_info.get("ie"),
        "razao_social": payload.razao_social or comp_info.get("razao_social", ""),
        "email": payload.email or comp_info.get("email"),
        "telefone": payload.telefone or comp_info.get("telefone"),
        "endereco": payload.endereco or comp_info.get("endereco"),
        "protheus_grupo": payload.protheus_grupo or comp_info.get("protheus_grupo", ""),
        "protheus_empresa": payload.protheus_empresa or comp_info.get("protheus_empresa"),
        "protheus_unidade": payload.protheus_unidade or comp_info.get("protheus_unidade"),
        "protheus_filial": payload.protheus_filial or comp_info.get("protheus_filial", ""),
        "protheus_ambientes": payload.protheus_ambientes or comp_info.get("protheus_ambientes", "producao"),
        "protheus_usuario": payload.protheus_usuario or comp_info.get("protheus_usuario"),
        "protheus_rest_url": payload.protheus_rest_url or comp_info.get("protheus_rest_url"),
        "protheus_webapp_url": payload.protheus_webapp_url or comp_info.get("protheus_webapp_url"),
        "licenca_uso": payload.licenca_uso or comp_info.get("licenca_uso"),
        "status": payload.status or comp_info.get("status", "ativa"),
        "created_at": res[1] if res and res[1] else now,
        "updated_at": res[2] if res and res[2] else now
    }


@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    comp_info = get_company_or_404(db, company_id)
    tenant_code = str(comp_info.get("tenant_id") or "default")
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_code)
    if clean_tenant and clean_tenant != "public":
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".company_info WHERE id = :cid'), {"cid": company_id})
            db.commit()
        except Exception as e:
            logger.error(f"Erro ao excluir company {company_id} em {clean_tenant}: {e}")
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
    comp_info = get_company_or_404(db, company_id)
    total_queries = 0
    tenant_code = str(comp_info.get("tenant_id") or "default")
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_code)
    if clean_tenant and clean_tenant != "public":
        try:
            from app.db.database import ensure_tenant_tables
            ensure_tenant_tables(db, clean_tenant)
            row = db.execute(text(f'SELECT COUNT(*) FROM "{clean_tenant}".query_audit')).first()
            if row and row[0]:
                total_queries = row[0]
        except Exception:
            pass

    return {
        "company_id": company_id,
        "total_queries": total_queries,
        "note": "Billing V5: baseado em query_audit por tenant."
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
