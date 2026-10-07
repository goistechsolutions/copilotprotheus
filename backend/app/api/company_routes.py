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

from app.db.database import get_db, resolve_clean_tenant
from app.models.knowledge import (
    Company, AgentQueryAudit,
    ProtheusModuleMaster, TenantContract
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
from app.services.queryrest_service import queryrest_exec_tenant
from app.services.sync_dictionary_v52 import run_snapshot
from app.core.config import settings
from app.core.security import encrypt_password
from app.core.admin_security import authorize_admin_access, require_admin

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
            jwt_secret = os.getenv("ADMIN_JWT_SECRET") or "elitecorp-admin-secret-change-in-prod"
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
    admin: dict = Depends(require_admin),
):
    if tenant_id:
        authorize_admin_access(admin, "companies:read", tenant_id)
    items = list_companies(db, tenant_id=tenant_id)
    return {
        "status": "success",
        "items": items,
    }


@router.get("/companies/{company_id}/modules/available", response_model=CompanyModulesAvailableResponse)
async def get_available_modules(
    company_id: str,
    environment_code: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    company = get_company_or_404(db, company_id)
    tenant_id = company.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Tenant da empresa não encontrado")
    authorize_admin_access(admin, "modules:read", tenant_id)
    if environment_code.strip().lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="environment_code deve identificar um ambiente real")

    # 1. Tenta buscar módulos do Protheus real (SYS_USR_MODULE)
    sql = "SELECT DISTINCT USR_MODULO, USR_CODMOD, USR_NOME FROM SYS_USR_MODULE ORDER BY USR_MODULO"
    rows = []
    try:
        rows = await queryrest_exec_tenant(
            db=db,
            tenant_id=tenant_id,
                        company_id=company_id,
            query=sql,
            environment_code=environment_code.strip(),

        )
    except Exception as e:
        logger.warning(f"Aviso ao consultar SYS_USR_MODULE ({company_id}): {e}")

    if rows:
        items = []
        seen = set()
        for row in rows:
            # USR_MODULO = código numérico real do X2_MODULO no Protheus
            # USR_CODMOD = sigla (SIGAFAT, SIGAFIN...)
            # USR_NOME   = descrição
            mod_code_raw = str(row.get("USR_MODULO") or "").strip()
            mod_sigla    = str(row.get("USR_CODMOD") or "").strip().upper()
            mod_name     = str(row.get("USR_NOME")   or mod_sigla).strip()

            if not mod_sigla or mod_sigla in seen:
                continue

            mod_code_int = int(mod_code_raw) if mod_code_raw.isdigit() else 0
            seen.add(mod_sigla)
            items.append({
                "id": mod_code_int,
                "module_sigla": mod_sigla,
                "description":  mod_name,
            })

            # ── Atualiza protheus_modules_master com os códigos reais do Protheus ──
            if mod_code_int > 0:
                try:
                    existing = db.query(ProtheusModuleMaster).filter(
                        ProtheusModuleMaster.id == mod_code_int
                    ).first()
                    if existing:
                        existing.module_sigla = mod_sigla or existing.module_sigla
                        existing.description = mod_name or existing.description
                        existing.active   = True
                    else:
                        db.add(ProtheusModuleMaster(
                            id=mod_code_int,
                            module_sigla=mod_sigla,
                            description=mod_name,
                            active=True
                        ))
                except Exception as ex_upsert:
                    logger.warning(f"Aviso ao upsert módulo {mod_sigla}: {ex_upsert}")

        try:
            db.commit()
        except Exception:
            db.rollback()

        return {
            "status":     "success",
            "tenant_id":  tenant_id,
            "company_id": str(company_id),
            "items":      items,
        }

    # 2. Fallback: lê do catálogo master interno (sem Protheus disponível)
    master_mods = db.query(ProtheusModuleMaster).filter(ProtheusModuleMaster.active == True).all()
    return {
        "status":     "success",
        "tenant_id":  tenant_id,
        "company_id": str(company_id),
        "items": [
            {
                "id": m.id,
                "module_sigla": m.module_sigla,
                "description":  m.description or m.module_sigla,
            }
            for m in master_mods if m.module_sigla
        ],
    }




@router.get("/companies/{company_id}/modules", response_model=CompanyModulesAssignedResponse)
def get_modules_by_company(
    company_id: str,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    company = get_company_or_404(db, company_id)
    authorize_admin_access(admin, "modules:read", company["tenant_id"])

    items = list_company_modules(
        db=db,
        company_id=company_id,
        tenant_id=company["tenant_id"],
    )

    return {
        "status": "success",
        "company_id": str(company_id),
        "items": items,
    }


@router.post("/companies/{company_id}/modules", response_model=CompanyModulesSaveResponse)
def save_modules_by_company(
    company_id: str,
    payload: CompanyModulesSaveRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    company = get_company_or_404(db, company_id)
    authorize_admin_access(admin, "modules:write", company["tenant_id"])

    modules_saved = replace_company_modules(
        db=db,
        company_id=company_id,
        tenant_id=company["tenant_id"],
        payload=payload,
    )

    return {
        "status": "success",
        "company_id": str(company_id),
        "modules_saved": modules_saved,
    }


@router.post("/companies/{company_id}/modules/sync", response_model=CompanyModulesSyncResponse)
def sync_modules_dictionary(
    company_id: str,
    payload: CompanyModulesSyncRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    company = get_company_or_404(db, company_id)
    authorize_admin_access(admin, "modules:sync", company["tenant_id"])

    import re
    from app.db.database import ensure_tenant_tables
    try:
        clean_tenant = resolve_clean_tenant(db, company.get("tenant_id"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
            environment_code=payload.environment_code,
            company_id=str(company_id),
            session=db,
            module_filter=module_filter,
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
def list_all_companies(tenant_id: Optional[str] = Query(default=None), db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    if tenant_id:
        authorize_admin_access(admin, "companies:read", tenant_id)
    from app.services.company_module_service import list_companies
    return list_companies(db, tenant_id=tenant_id)


@router.get("/companies/by-tenant/{tenant_id}", response_model=CompanyResponse)
def get_company_by_tenant(tenant_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    authorize_admin_access(admin, "companies:read", tenant_id)
    from app.services.company_module_service import get_company_or_404
    return get_company_or_404(db, tenant_id)


@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    from app.services.company_module_service import get_company_or_404
    comp = get_company_or_404(db, company_id)
    authorize_admin_access(admin, "companies:read", comp.get("tenant_id"))
    return comp


def sync_company_into_tenant_schema(db: Session, comp: Company):
    import re
    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    
    tenant_code = str(
        getattr(comp, 'tenant_id', None)
        or getattr(comp, 'protheus_grupo', None)
        or ""
    ).strip()
    if not tenant_code:
        raise ValueError("tenant_id do tenant é obrigatório para sincronizar a empresa.")
    clean_tenant = resolve_clean_tenant(db, tenant_code)

    try:
        ensure_tenant_tables(db, clean_tenant)
        
        c_code = getattr(comp, 'protheus_empresa', None) or getattr(comp, 'company_code', None)
        b_code = getattr(comp, 'protheus_filial', None) or getattr(comp, 'protheus_branch', None)
        c_name = getattr(comp, 'razao_social', None) or getattr(comp, 'company_name', None)
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
        c_env  = getattr(comp, 'protheus_ambientes', None) or getattr(comp, 'protheus_env', None)
        c_rest = getattr(comp, 'protheus_rest_url', None) or ""
        c_app  = getattr(comp, 'protheus_webapp_url', None) or ""
        c_user = getattr(comp, 'protheus_usuario', None) or ""
        c_pass = getattr(comp, 'encrypted_protheus_password', None) or ""
        c_status = getattr(comp, 'status', None) or "active"

        upsert_company_info = text(f"""
            INSERT INTO "{clean_tenant}".company_info (
                tenant_id, company_code, branch_code, company_name, cnpj, ie, razao_social, email, telefone, endereco,
                protheus_grupo, protheus_empresa, protheus_unidade, protheus_filial, environment,
                webapp_url, protheus_rest_url, protheus_usuario, encrypted_protheus_password, auth_mode, status
            ) VALUES (
                :tid, :c_code, :b_code, :c_name, :c_cnpj, :c_ie, :c_rz, :c_email, :c_tel, :c_end,
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
            "tid": clean_tenant,
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
async def create_company(payload: CompanyCreate, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    import json
    from app.core.security import encrypt_password
    
    raw_tenant = str(payload.tenant_id or payload.protheus_grupo or "").strip()
    if not raw_tenant:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório para criar uma empresa.")
        
    tenant_code = raw_tenant
    
    try:
        if raw_tenant.isdigit():
            reg = db.execute(text("SELECT tenant_code, schema_name FROM public.tenants WHERE id = :id OR tenant_code = :tc"), {"id": int(raw_tenant), "tc": raw_tenant}).mappings().first()
            if reg:
                tenant_code = reg["schema_name"] or reg["tenant_code"]
        else:
            reg = db.execute(text("SELECT tenant_code, schema_name FROM public.tenants WHERE tenant_code = :tc OR schema_name = :tc"), {"tc": raw_tenant}).mappings().first()
            if reg:
                tenant_code = reg["schema_name"] or reg["tenant_code"]
    except Exception:
        pass
        
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    if not clean_tenant or clean_tenant == "public":
        raise HTTPException(status_code=400, detail="tenant_id inválido para criação da empresa.")
        
    authorize_admin_access(admin, "companies:write", clean_tenant)
    
    db.execute(text("""
        INSERT INTO public.tenants (tenant_code, tenant_name, schema_name, status)
        VALUES (:tenant_code, :tenant_name, :schema_name, 'ACTIVE')
        ON CONFLICT (tenant_code) DO UPDATE SET
            tenant_name = EXCLUDED.tenant_name,
            schema_name = EXCLUDED.schema_name,
            status = 'ACTIVE',
            updated_at = NOW()
    """), {
        "tenant_code": clean_tenant,
        "tenant_name": (payload.razao_social or payload.company_name).strip(),
        "schema_name": clean_tenant,
    })
    db.commit()
    
    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)
    
    c_code = (payload.protheus_empresa or payload.company_code).strip()
    b_code = (payload.protheus_filial or payload.branch_code or "0101").strip()
    c_name = (payload.razao_social or payload.company_name).strip()
    c_env  = (payload.protheus_ambientes or payload.environment or "PROD").strip()
    
    if not c_code or not b_code or not c_name:
        raise HTTPException(status_code=400, detail="company_code, branch_code e company_name são obrigatórios.")
        
    company_id = db.execute(text(f"""
        INSERT INTO "{clean_tenant}".companies (company_code, branch_code, legal_name, tax_id, status)
        VALUES (:c_code, :b_code, :c_name, :cnpj, :status)
        ON CONFLICT (company_code, branch_code) DO UPDATE SET
            legal_name = EXCLUDED.legal_name,
            tax_id = EXCLUDED.tax_id,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id
    """), {
        "c_code": c_code, "b_code": b_code, "c_name": c_name, "cnpj": payload.cnpj, "status": 'ACTIVE'
    }).scalar()
    
    env_id = db.execute(text(f"""
        INSERT INTO "{clean_tenant}".environments (environment_code, environment_name, status)
        VALUES (:env_code, :env_name, 'ACTIVE')
        ON CONFLICT (environment_code) DO UPDATE SET
            environment_name = EXCLUDED.environment_name,
            status = 'ACTIVE'
        RETURNING id
    """), {
        "env_code": c_env, "env_name": c_env
    }).scalar()
    
    if payload.protheus_rest_url:
        sec_data = {
            "protheus_username": payload.protheus_usuario,
            "encrypted_protheus_password": encrypt_password(payload.protheus_password) if payload.protheus_password else None
        }
        db.execute(text(f"""
            INSERT INTO "{clean_tenant}".protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
            VALUES (:env_id, :url, 'oauth2_password', :sec, true)
            ON CONFLICT (environment_id) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                secret_ref = EXCLUDED.secret_ref,
                active = true,
                updated_at = NOW()
        """), {
            "env_id": env_id,
            "url": payload.protheus_rest_url,
            "sec": json.dumps(sec_data)
        })
        
    db.commit()
    
    now = datetime.now()
    return {
        "id": 1,
        "tenant_id": clean_tenant,
        "cnpj": payload.cnpj,
        "ie": payload.ie,
        "razao_social": c_name,
        "email": payload.email,
        "telefone": payload.telefone,
        "endereco": payload.endereco,
        "protheus_grupo": payload.protheus_grupo,
        "protheus_empresa": payload.protheus_empresa,
        "protheus_unidade": payload.protheus_unidade,
        "protheus_filial": payload.protheus_filial,
        "protheus_ambientes": c_env,
        "protheus_usuario": payload.protheus_usuario,
        "protheus_rest_url": payload.protheus_rest_url,
        "webapp_url": payload.webapp_url,
        "has_password": bool(payload.protheus_password),
        "status": "ativa",
        "created_at": now,
        "updated_at": now
    }


@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    from app.services.company_module_service import get_company_or_404
    comp_info = get_company_or_404(db, company_id)
    tenant_code = str(comp_info.get("tenant_id") or "").strip()
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    if clean_tenant and clean_tenant != "public":
        authorize_admin_access(admin, "companies:write", clean_tenant)
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".companies WHERE id::text = :cid'), {"cid": str(company_id)})
            db.commit()
        except Exception as e:
            pass
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
def get_company_billing(company_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    from app.services.company_module_service import get_company_or_404
    comp_info = get_company_or_404(db, company_id)
    total_queries = 0
    tenant_code = str(comp_info.get("tenant_id") or "").strip()
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    
    if clean_tenant and clean_tenant != "public":
        authorize_admin_access(admin, "companies:read", clean_tenant)
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
