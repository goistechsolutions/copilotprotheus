import uuid
import datetime
import re
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas.company_modules import CompanyModulesSaveRequest
from app.db.database import ensure_tenant_tables

logger = logging.getLogger("app.services.company_module_service")


def get_company_or_404(db: Session, company_id: int | str) -> dict:
    cid_str = str(company_id).strip()
    clean_tenant = ""
    
    # 1. Busca no tenant_registry global por id, tenant_code ou schema_name
    try:
        reg = db.execute(
            text("""
                SELECT id, tenant_code, tenant_name, schema_name, status
                FROM public.tenant_registry
                WHERE id::text = :cid OR tenant_code = :cid OR schema_name = :cid
                LIMIT 1
            """),
            {"cid": cid_str}
        ).mappings().first()

        if not reg and cid_str.isdigit():
            reg = db.execute(
                text("SELECT id, tenant_code, tenant_name, schema_name, status FROM public.tenant_registry ORDER BY id ASC LIMIT 1")
            ).mappings().first()

        if reg:
            clean_tenant = reg.get("schema_name") or reg.get("tenant_code")
    except Exception:
        pass

    if not clean_tenant or clean_tenant.isdigit():
        clean_tenant = "default"

    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(clean_tenant))
    if not clean_tenant or clean_tenant == "public" or clean_tenant.isdigit():
        clean_tenant = "default"

    # Garante que o schema existe
    ensure_tenant_tables(db, clean_tenant)

    # 2. Busca na tabela company_info do schema exclusivo do tenant
    try:
        row = db.execute(
            text(f"""
                SELECT
                    id,
                    '{clean_tenant}' AS tenant_id,
                    company_code AS code,
                    COALESCE(company_name, razao_social, 'Empresa ' || id) AS name,
                    status,
                    protheus_rest_url,
                    protheus_usuario,
                    encrypted_protheus_password,
                    environment AS protheus_ambientes
                FROM "{clean_tenant}".company_info
                ORDER BY id ASC
                LIMIT 1
            """)
        ).mappings().first()

        if row:
            return dict(row)
    except Exception as e:
        logger.warning(f"Aviso ao buscar company_info em {clean_tenant}: {e}")

    # Fallback se tenant_registry existe mas company_info ainda está vazia
    if reg:
        return {
            "id": reg["id"],
            "tenant_id": reg["tenant_code"],
            "code": reg["tenant_code"],
            "name": reg["tenant_name"],
            "status": reg["status"],
            "protheus_rest_url": None,
            "protheus_usuario": None,
            "encrypted_protheus_password": None,
            "protheus_ambientes": "producao"
        }

    raise HTTPException(status_code=404, detail=f"Empresa '{company_id}' não encontrada")


def list_companies(db: Session, tenant_id: str | None = None) -> list[dict]:
    sql = "SELECT id, tenant_code, tenant_name, status, created_at, updated_at FROM public.tenant_registry WHERE 1=1"
    params = {}
    if tenant_id:
        sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id)"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY tenant_name"
    rows = db.execute(text(sql), params).mappings().all()

    result = []
    for r in rows:
        t_code = r["tenant_code"]
        clean = re.sub(r'[^a-zA-Z0-9_]', '', t_code)
        if not clean or clean == "public":
            continue

        try:
            ensure_tenant_tables(db, clean)
            c_rows = db.execute(
                text(f"""
                    SELECT
                        id,
                        COALESCE(tenant_id, '{clean}') AS tenant_id,
                        COALESCE(cnpj, '') AS cnpj,
                        ie,
                        COALESCE(razao_social, company_name, '{r["tenant_name"]}') AS razao_social,
                        email,
                        telefone,
                        endereco,
                        COALESCE(protheus_grupo, '{clean}') AS protheus_grupo,
                        protheus_empresa,
                        protheus_unidade,
                        COALESCE(protheus_filial, '0101') AS protheus_filial,
                        COALESCE(protheus_ambientes, environment, 'producao') AS protheus_ambientes,
                        protheus_usuario,
                        protheus_rest_url,
                        webapp_url AS protheus_webapp_url,
                        COALESCE(status, 'ativa') AS status,
                        created_at,
                        updated_at
                    FROM "{clean}".company_info
                    ORDER BY id ASC
                """)
            ).mappings().all()

            for c in c_rows:
                cd = dict(c)
                if not cd.get("razao_social"):
                    cd["razao_social"] = r["tenant_name"]
                if not cd.get("protheus_grupo"):
                    cd["protheus_grupo"] = clean
                if not cd.get("protheus_filial"):
                    cd["protheus_filial"] = "0101"
                result.append(cd)

            if not c_rows:
                result.append({
                    "id": r["id"],
                    "tenant_id": t_code,
                    "cnpj": "",
                    "ie": None,
                    "razao_social": r["tenant_name"],
                    "email": None,
                    "telefone": None,
                    "endereco": None,
                    "protheus_grupo": t_code,
                    "protheus_empresa": "01",
                    "protheus_unidade": "01",
                    "protheus_filial": "0101",
                    "protheus_ambientes": "producao",
                    "protheus_usuario": None,
                    "protheus_rest_url": None,
                    "protheus_webapp_url": None,
                    "licenca_uso": None,
                    "status": r["status"] or "ativa",
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"]
                })
        except Exception as e:
            logger.warning(f"Erro ao listar company_info em {clean}: {e}")

    return result


def list_company_modules(db: Session, company_id: int | str, tenant_id: str) -> list[dict]:
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    ensure_tenant_tables(db, clean_tenant)

    # 1. Carrega todos os módulos da tabela mestre no public
    master_rows = db.execute(
        text("""
            SELECT COALESCE(mod_code, module_code) AS module_code, COALESCE(mod_name, module_name) AS module_name
            FROM public.protheus_modules_master
            WHERE active = TRUE
            ORDER BY COALESCE(mod_code, module_code)
        """)
    ).mappings().all()

    # 2. Carrega contratos salvos no schema do tenant
    enabled_map = {}
    try:
        contracts = db.execute(
            text(f'SELECT mod_code, enabled FROM "{clean_tenant}".protheus_modules')
        ).mappings().all()
        for c in contracts:
            if c.get("usr_codmod"):
                enabled_map[c["usr_codmod"].strip().upper()] = True
    except Exception:
        pass

    result = []
    for m in master_rows:
        m_code = (m["module_code"] or "").strip().upper()
        if not m_code:
            continue
        is_enabled = enabled_map.get(m_code, True)
        result.append({
            "company_id": company_id,
            "tenant_id": tenant_id,
            "module_code": m_code,
            "module_name": m["module_name"] or m_code,
            "enabled": is_enabled,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

    return result


def replace_company_modules(
    db: Session,
    company_id: int | str,
    tenant_id: str,
    payload: CompanyModulesSaveRequest,
) -> int:
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    ensure_tenant_tables(db, clean_tenant)

    try:
        db.execute(text(f'DELETE FROM "{clean_tenant}".protheus_modules'))
        for item in payload.modules:
            if not item.enabled:
                continue
            m_code = item.module_code.strip().upper()
            m_name = (item.module_name or m_code).strip()
            
            db.execute(
                text(f"""
                    INSERT INTO "{clean_tenant}".protheus_modules (tenant_id, usr_modulo, usr_codmod)
                    VALUES (:tid, :mname, :mcode);
                """),
                {"tid": tenant_id, "mname": m_name, "mcode": m_code}
            )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao salvar módulos no schema do tenant: {str(e)}"
        )

    return len([m for m in payload.modules if m.enabled])


def get_enabled_modules(db: Session, company_id: int | str, tenant_id: str) -> list[str]:
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    ensure_tenant_tables(db, clean_tenant)

    enabled = []
    try:
        rows = db.execute(
            text(f'SELECT usr_codmod FROM "{clean_tenant}".protheus_modules')
        ).mappings().all()
        enabled = [r["usr_codmod"].strip().upper() for r in rows if r.get("usr_codmod")]
    except Exception:
        pass

    if not enabled:
        try:
            m_rows = db.execute(
                text("SELECT COALESCE(mod_code, module_code) AS module_code FROM public.protheus_modules_master WHERE active = TRUE")
            ).mappings().all()
            enabled = [r["module_code"].strip().upper() for r in m_rows if r.get("module_code")]
        except Exception:
            enabled = ["SIGAFAT", "SIGAFIN", "SIGACOM", "SIGAEST", "SIGAPCP", "SIGACONT", "SIGAFIS", "SIGATMS", "SIGAGPE", "SIGAATF"]

    return enabled


def preload_allowed_tables_from_dictionary(db: Session, company_id: int | str, tenant_id: str):
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    ensure_tenant_tables(db, clean_tenant)

    try:
        db.execute(
            text(f'UPDATE "{clean_tenant}".dictionary_tables SET active_flag = TRUE WHERE active_flag IS NULL')
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Aviso ao atualizar tabelas permitidas no dicionário em {clean_tenant}: {e}")
