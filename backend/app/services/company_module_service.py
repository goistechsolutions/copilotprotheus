import logging
from sqlalchemy import text
from fastapi import HTTPException
from app.db.database import ensure_tenant_tables
from app.services.tenant_resolver import resolve_clean_tenant

logger = logging.getLogger(__name__)

def get_company_modules_catalog(db) -> dict[str, dict]:
    """Retorna dicionário map de módulos globais ativados por sigla."""
    try:
        rows = db.execute(
            text("""
            SELECT id, module_sigla, description
            FROM public.protheus_modules_master
            WHERE active = TRUE
            ORDER BY id
            """)
        ).mappings().all()

        master_map: dict[str, dict] = {}
        for row in rows:
            sigla = str(row.get("module_sigla") or "").strip().upper()
            m_id = row.get("id")
            if not sigla or not m_id:
                continue
            master_map[sigla] = {
                "module_id": m_id,
                "description": str(row.get("description") or sigla).strip(),
            }
        return master_map
    except Exception as e:
        logger.error(f"Erro ao obter catalogo de módulos: {e}")
        return {}


def get_tenant_module_setup(db, tenant_id: str) -> list[dict]:
    clean_tenant = resolve_clean_tenant(tenant_id)
    if not clean_tenant:
        raise HTTPException(status_code=404, detail="Tenant invalido")
        
    master_rows = db.execute(
        text("""
            SELECT id, module_sigla, description
            FROM public.protheus_modules_master
            WHERE active = TRUE
            ORDER BY id
        """)
    ).mappings().all()

    enabled_codes: set[int] = set()
    try:
        contracts = db.execute(
            text(f'SELECT module_id FROM "{clean_tenant}".tenant_modules WHERE enabled = true')
        ).mappings().all()
        enabled_codes = {int(c["module_id"]) for c in contracts if c.get("module_id") is not None}
    except Exception as e:
        logger.debug(f"Sem módulos salvos em {clean_tenant}: {e}")

    result = []
    for m in master_rows:
        m_id = m["id"]
        m_sigla = str(m["module_sigla"] or "").strip().upper()
        m_desc = str(m["description"] or m_sigla).strip()
        if not m_sigla:
            continue
            
        result.append({
            "module_id": m_id,
            "module_sigla": m_sigla,
            "description": m_desc,
            "enabled": (m_id in enabled_codes)
        })

    return result

def replace_company_modules(db, company_id, tenant_id: str, payload) -> int:
    clean_tenant = resolve_clean_tenant(tenant_id)
    if not clean_tenant:
        raise HTTPException(status_code=404, detail="Tenant inválido")

    try:
        db.execute(text(f'UPDATE "{clean_tenant}".tenant_modules SET enabled = false'))
        
        master_catalog = get_company_modules_catalog(db)
        
        for item in payload.modules:
            sigla = str(getattr(item, "module_code", item[0] if isinstance(item, tuple) else item)).strip().upper()
            master = master_catalog.get(sigla)
            if not master:
                raise HTTPException(status_code=400, detail={"code": "MODULE_NOT_FOUND", "message": f"Module {sigla} not found"})
                
            m_id = master["module_id"]
            db.execute(
                text(f'''
                    INSERT INTO "{clean_tenant}".tenant_modules (module_id, enabled)
                    VALUES (:mid, true)
                    ON CONFLICT (module_id) DO UPDATE SET enabled = true
                '''),
                {"mid": m_id}
            )
            
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar módulos: {e}")

    return 1


def get_enabled_company_modules(db, tenant_id: str) -> list[str]:
    clean_tenant = resolve_clean_tenant(tenant_id)
    if not clean_tenant:
        return []

    try:
        rows = db.execute(
            text(f'''
                SELECT m.module_sigla 
                FROM "{clean_tenant}".tenant_modules tm 
                JOIN public.protheus_modules_master m ON m.id = tm.module_id 
                WHERE tm.enabled = true 
                ORDER BY tm.module_id
            ''')
        ).mappings().all()
        enabled = [r["module_sigla"].strip().upper() for r in rows if r.get("module_sigla")]
        return enabled
    except Exception as e:
        logger.debug(f"Falha ao ler modulos do tenant {tenant_id}: {e}")
        return []
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException

def get_company_or_404(db: Session, company_id) -> dict:
    cid_str = str(company_id).strip()
    reg = db.execute(
        text("""
            SELECT id, tenant_code, tenant_name, schema_name, status
            FROM public.tenants
            WHERE id::text = :cid OR tenant_code = :cid OR schema_name = :cid
            LIMIT 1
        """),
        {"cid": cid_str}
    ).mappings().first()
    
    if not reg:
        raise HTTPException(status_code=404, detail="Empresa/Tenant não encontrado")
    
    return dict(reg)
def get_enabled_modules(db, company_id, tenant_id: str) -> list[str]:
    enabled = get_enabled_company_modules(db, tenant_id)
    if not enabled:
        raise HTTPException(
            status_code=400, 
            detail="Nenhum módulo habilitado ou contratado encontrado para este tenant."
        )
    return enabled


def list_companies(db, tenant_id=None):
    from sqlalchemy import text
    sql = "SELECT id, tenant_code, tenant_name, status, created_at, updated_at FROM public.tenants WHERE 1=1"
    params = {}
    if tenant_id:
        sql += " AND (tenant_code = :tenant_id OR schema_name = :tenant_id OR id::text = :tenant_id)"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY tenant_name"
    rows = db.execute(text(sql), params).mappings().all()

    result = []
    for r in rows:
        t_code = r["tenant_code"]
        try:
            clean = resolve_clean_tenant(t_code)
        except TypeError:
            clean = resolve_clean_tenant(db, t_code)
        except Exception:
            clean = t_code

        try:
            c_rows = db.execute(text(f'SELECT id, company_code, branch_code, legal_name, tax_id, status FROM "{clean}".companies')).mappings().all()
            if not c_rows:
                continue
            
            # Buscar conexão ativa e ambiente do tenant
            active_conn = None
            try:
                active_conn_rows = db.execute(text(f'''
                    SELECT e.environment_code, c.base_rest_url
                    FROM "{clean}".protheus_connections c
                    JOIN "{clean}".environments e ON e.id = c.environment_id
                    WHERE c.active = TRUE
                    ORDER BY c.updated_at DESC
                    LIMIT 1
                ''')).mappings().all()
                active_conn = active_conn_rows[0] if active_conn_rows else None
            except Exception:
                pass

            env_code = active_conn["environment_code"] if active_conn else ""
            rest_url = active_conn["base_rest_url"] if active_conn else ""

            for c in c_rows:
                result.append({
                    "id": c["id"],
                    "tenant_id": t_code,
                    "tenant_name": r["tenant_name"],
                    "cnpj": c.get("tax_id") or "",
                    "razao_social": c.get("legal_name") or "",
                    "protheus_empresa": c.get("company_code") or "",
                    "protheus_filial": c.get("branch_code") or "",
                    "protheus_ambientes": env_code,
                    "protheus_rest_url": rest_url,
                    "status": c.get("status") or "ACTIVE"
                })
        except Exception as e:
            logger.warning("Erro ao listar empresas do tenant %s: %s", clean, e)

    return result


def list_company_modules(db, company_id, tenant_id: str) -> list[dict]:
    return get_tenant_module_setup(db, tenant_id)

def preload_allowed_tables_from_dictionary(db, company_id, tenant_id: str):
    clean_tenant = resolve_clean_tenant(tenant_id)
    try:
        db.execute(text(f'UPDATE "{clean_tenant}".dictionary_tables SET status = \'ACTIVE\''))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Aviso ao atualizar tabelas permitidas em {clean_tenant}: {e}")
