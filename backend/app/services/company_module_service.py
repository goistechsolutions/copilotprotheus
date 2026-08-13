"""
company_module_service.py — V5 Multi-Tenant
Alinhado ao DDL V5:
  public.protheus_modules_master : mod_code (int), mod_sigla (varchar), mod_name (varchar)
  <tenant>.protheus_modules       : mod_code (int), mod_sigla (varchar), mod_name (varchar)
"""
import datetime
import re
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas.company_modules import CompanyModulesSaveRequest
from app.db.database import ensure_tenant_tables

logger = logging.getLogger("app.services.company_module_service")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────────────────────────────────────

def _clean(tenant_id: str | None) -> str:
    """Normaliza tenant_id para nome seguro de schema."""
    raw = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not raw or raw == 'public' or raw.isdigit():
        return 'default'
    return raw


# ─────────────────────────────────────────────────────────────────────────────
# get_company_or_404
# ─────────────────────────────────────────────────────────────────────────────

def get_company_or_404(db: Session, company_id: int | str) -> dict:
    cid_str = str(company_id).strip()
    clean_tenant = ""
    reg = None

    try:
        reg = db.execute(
            text("""
                SELECT id, tenant_code, tenant_name, schema_name, status
                FROM public.tenant
                WHERE id::text = :cid OR tenant_code = :cid OR schema_name = :cid
                LIMIT 1
            """),
            {"cid": cid_str}
        ).mappings().first()

        if not reg and cid_str.isdigit():
            reg = db.execute(
                text("SELECT id, tenant_code, tenant_name, schema_name, status FROM public.tenant ORDER BY id ASC LIMIT 1")
            ).mappings().first()

        if reg:
            clean_tenant = reg.get("schema_name") or reg.get("tenant_code") or ""
    except Exception as e:
        db.rollback()
        logger.warning(f"Aviso ao buscar tenant: {e}")

    clean_tenant = _clean(clean_tenant)
    ensure_tenant_tables(db, clean_tenant)

    try:
        row = db.execute(
            text(f"""
                SELECT
                    id,
                    '{clean_tenant}' AS tenant_id,
                    company_code      AS code,
                    COALESCE(company_name, razao_social, 'Empresa ' || id) AS name,
                    status,
                    protheus_url || ':' || protheus_rest_port::text AS protheus_rest_url,
                    protheus_user     AS protheus_usuario,
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
        db.rollback()
        logger.warning(f"Aviso ao buscar company_info em {clean_tenant}: {e}")

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
            "protheus_ambientes": "producao",
        }

    raise HTTPException(status_code=404, detail=f"Empresa '{company_id}' não encontrada")


# ─────────────────────────────────────────────────────────────────────────────
# list_companies
# ─────────────────────────────────────────────────────────────────────────────

def list_companies(db: Session, tenant_id: str | None = None) -> list[dict]:
    sql = "SELECT id, tenant_code, tenant_name, status, created_at, updated_at FROM public.tenant WHERE 1=1"
    params: dict = {}
    if tenant_id:
        sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id)"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY tenant_name"
    rows = db.execute(text(sql), params).mappings().all()

    result = []
    for r in rows:
        t_code = r["tenant_code"]
        clean = _clean(t_code)

        try:
            ensure_tenant_tables(db, clean)
            c_rows = db.execute(
                text(f"""
                    SELECT
                        id,
                        COALESCE(tenant_id, '{clean}')                         AS tenant_id,
                        COALESCE(cnpj, '')                                      AS cnpj,
                        ie,
                        COALESCE(razao_social, company_name, '{r["tenant_name"]}') AS razao_social,
                        email,
                        telefone,
                        endereco,
                        COALESCE(protheus_grupo, '{clean}')                     AS protheus_grupo,
                        protheus_empresa,
                        protheus_unidade,
                        COALESCE(protheus_filial, '0101')                       AS protheus_filial,
                        COALESCE(protheus_ambientes, environment, 'producao')   AS protheus_ambientes,
                        protheus_user                                           AS protheus_usuario,
                        protheus_url || ':' || protheus_rest_port::text         AS protheus_rest_url,
                        webapp_url,
                        COALESCE(status, 'ativa')                               AS status,
                        created_at,
                        updated_at
                    FROM "{clean}".company_info
                    ORDER BY id ASC
                """)
            ).mappings().all()

            for c in c_rows:
                cd = dict(c)
                cd.setdefault("razao_social", r["tenant_name"])
                cd.setdefault("protheus_grupo", clean)
                cd.setdefault("protheus_filial", "0101")
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
                    "webapp_url": None,
                    "status": r["status"] or "ativa",
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                })
        except Exception as e:
            logger.warning(f"Erro ao listar company_info em {clean}: {e}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# list_company_modules
# Retorna TODOS os módulos do master, marcando quais estão habilitados no tenant
# ─────────────────────────────────────────────────────────────────────────────

def list_company_modules(db: Session, company_id: int | str, tenant_id: str) -> list[dict]:
    clean_tenant = _clean(tenant_id)
    ensure_tenant_tables(db, clean_tenant)

    # 1. Catálogo global (DDL V5: mod_code, mod_sigla, mod_name)
    master_rows = db.execute(
        text("""
            SELECT mod_code, mod_sigla, mod_name
            FROM public.protheus_modules_master
            WHERE active = TRUE
            ORDER BY mod_code
        """)
    ).mappings().all()

    # 2. Módulos habilitados no schema do tenant (DDL V5: mod_code)
    enabled_codes: set[int] = set()
    try:
        contracts = db.execute(
            text(f'SELECT mod_code FROM "{clean_tenant}".protheus_modules')
        ).mappings().all()
        enabled_codes = {int(c["mod_code"]) for c in contracts if c.get("mod_code") is not None}
    except Exception as e:
        logger.debug(f"Sem módulos salvos em {clean_tenant}: {e}")

    result = []
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for m in master_rows:
        m_code = m["mod_code"]         # int
        m_sigla = str(m["mod_sigla"] or "").strip().upper()  # SIGAFAT
        m_name = str(m["mod_name"] or m_sigla).strip()       # Nome completo

        if not m_sigla:
            continue

        result.append({
            "company_id": company_id,
            "tenant_id": tenant_id,
            "module_code": m_sigla,       # campo usado no frontend
            "module_name": m_name,
            "mod_code": m_code,           # ID numérico auxiliar
            "enabled": m_code in enabled_codes,
            "created_at": now,
        })

    return result


# ─────────────────────────────────────────────────────────────────────────────
# replace_company_modules
# Salva lista de módulos habilitados no schema do tenant
# DDL V5: tenant.protheus_modules(mod_code, mod_sigla, mod_name, tenant_id)
# ─────────────────────────────────────────────────────────────────────────────

def replace_company_modules(
    db: Session,
    company_id: int | str,
    tenant_id: str,
    payload: CompanyModulesSaveRequest,
) -> int:
    clean_tenant = _clean(tenant_id)
    ensure_tenant_tables(db, clean_tenant)

    # Monta mapeamento sigla → (mod_code, mod_name) a partir do master
    master_map: dict[str, dict] = {}
    try:
        rows = db.execute(
            text("SELECT mod_code, mod_sigla, mod_name FROM public.protheus_modules_master WHERE active = TRUE")
        ).mappings().all()
        for r in rows:
            sigla = str(r["mod_sigla"] or "").strip().upper()
            if sigla:
                master_map[sigla] = {"mod_code": r["mod_code"], "mod_name": r["mod_name"]}
    except Exception as e:
        logger.warning(f"Erro ao carregar master de módulos: {e}")

    try:
        db.execute(text(f'DELETE FROM "{clean_tenant}".protheus_modules'))

        saved = 0
        for item in payload.modules:
            if not item.enabled:
                continue

            m_sigla = item.module_code.strip().upper()   # campo do frontend = sigla
            master = master_map.get(m_sigla, {})
            m_code = master.get("mod_code", 0)           # int do master
            m_name = master.get("mod_name") or m_sigla   # nome descritivo

            db.execute(
                text(f"""
                    INSERT INTO "{clean_tenant}".protheus_modules
                        (tenant_id, mod_code, mod_sigla, mod_name)
                    VALUES (:tid, :mcode, :msigla, :mname)
                    ON CONFLICT (tenant_id, mod_code) DO UPDATE SET
                        mod_sigla = EXCLUDED.mod_sigla,
                        mod_name  = EXCLUDED.mod_name
                """),
                {
                    "tid":    clean_tenant,
                    "mcode":  m_code,
                    "msigla": m_sigla,
                    "mname":  m_name,
                }
            )
            saved += 1

        db.commit()
        return saved

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao salvar módulos no schema do tenant: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# get_enabled_modules
# Retorna lista de siglas habilitadas para filtrar o dicionário
# ─────────────────────────────────────────────────────────────────────────────

def get_enabled_modules(db: Session, company_id: int | str, tenant_id: str) -> list[str]:
    clean_tenant = _clean(tenant_id)
    ensure_tenant_tables(db, clean_tenant)

    # 1. Tenta buscar do schema do tenant (DDL V5: mod_sigla)
    try:
        rows = db.execute(
            text(f'SELECT mod_sigla FROM "{clean_tenant}".protheus_modules ORDER BY mod_code')
        ).mappings().all()
        enabled = [r["mod_sigla"].strip().upper() for r in rows if r.get("mod_sigla")]
        if enabled:
            return enabled
    except Exception as e:
        logger.debug(f"Sem módulos habilitados em {clean_tenant}: {e}")

    # 2. Fallback: todos do master
    try:
        m_rows = db.execute(
            text("SELECT mod_sigla FROM public.protheus_modules_master WHERE active = TRUE ORDER BY mod_code")
        ).mappings().all()
        enabled = [r["mod_sigla"].strip().upper() for r in m_rows if r.get("mod_sigla")]
        if enabled:
            return enabled
    except Exception:
        pass

    # 3. Lista mínima hardcoded como último recurso
    return ["SIGAFAT", "SIGAFIN", "SIGACOM", "SIGAEST", "SIGAPCP", "SIGAFIS", "SIGATMS", "SIGAGPE", "SIGAATF"]


# ─────────────────────────────────────────────────────────────────────────────
# preload_allowed_tables_from_dictionary
# ─────────────────────────────────────────────────────────────────────────────

def preload_allowed_tables_from_dictionary(db: Session, company_id: int | str, tenant_id: str):
    clean_tenant = _clean(tenant_id)
    ensure_tenant_tables(db, clean_tenant)

    try:
        db.execute(
            text(f'UPDATE "{clean_tenant}".dictionary_tables SET active_flag = TRUE WHERE active_flag IS NULL')
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Aviso ao atualizar tabelas permitidas em {clean_tenant}: {e}")
