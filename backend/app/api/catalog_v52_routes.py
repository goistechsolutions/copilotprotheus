"""
catalog_v52_routes.py — V5 Multi-Tenant

Endpoints de catálogo e dicionário de dados baseados na nova arquitetura V5.
Na V5, cada tenant tem seu próprio schema PostgreSQL e as tabelas sincronizadas
ficam em tenant_schemas com os campos armazenados em schema_json.

Endpoints:
  POST /api/admin/dictionary/snapshot     → Aciona sync (chama sync_schema V5)
  GET  /api/admin/dictionary/tables       → Lista tabelas/campos de tenant_schemas
  GET  /api/admin/snapshots               → Resumo de sincronizações por módulo
  GET  /api/agent/catalog/allowed         → Catálogo completo para o agente (GET)
  POST /api/agent/catalog/allowed         → Catálogo completo para o agente (POST)

REMOVIDO (V4 obsoleto):
  - GET/POST /api/admin/dictionary/permissions (controle por role desnecessário na V5)
  - get_allowed_catalog / get_structured_catalog_by_role (substituídos por leitura direta)
"""

import asyncio
import json
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db, resolve_clean_tenant
from app.api.admin_routes import verify_admin
from app.services.sync_dictionary_v52 import run_snapshot

logger = logging.getLogger("app.api.catalog_v52")

router = APIRouter(tags=["catalog-v52-governance"])


# ─── Request / Response Models ───────────────────────────────────────────────

class SnapshotRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=100, description="ID real do tenant")
    environment_id: str = Field(..., min_length=1, max_length=100, description="Código real do ambiente Protheus")
    company_id: Optional[str] = Field(None, description="ID opcional da empresa/filial")
    modules: Optional[List[str]] = Field(None, description="Módulos Protheus a sincronizar")
    async_mode: bool = Field(False, description="Executar em segundo plano")

class FieldPermissionItem(BaseModel):
    field_name: str
    can_select: bool = True
    can_filter: bool = True
    masked_flag: bool = False

class SaveTablePermissionRequest(BaseModel):
    tenant_id: str
    environment_id: str = Field(..., min_length=1, max_length=100)
    role_id: str

    table_name: str
    can_list: bool = True
    can_describe: bool = True
    can_query: bool = True
    approved_by: Optional[str] = None
    field_permissions: List[FieldPermissionItem] = []

class AllowedCatalogRequest(BaseModel):
    tenant_id: str
    environment_id: str = Field(..., min_length=1, max_length=100)
    role_ids: List[str]

# --- Endpoints Admin (Governança e Dicionário) ---


class CatalogRequest(BaseModel):
    tenant_id:    str           = Field(..., description="ID do tenant")
    mod_sigla:    Optional[str] = Field(None, description="Filtrar por sigla de módulo (ex: SIGAFIN)")
    table_filter: Optional[str] = Field(None, description="Filtrar por chave de tabela (ex: SA1)")


# ─── Helper ──────────────────────────────────────────────────────────────────

def _read_tenant_schemas(
    db: Session,
    clean_tenant: str,
    mod_sigla: Optional[str] = None,
    chave_filter: Optional[str] = None,
) -> list:
    """Lê tenant_schemas do schema do tenant com filtros opcionais."""
    conditions = []
    params: Dict[str, Any] = {}

    if mod_sigla:
        conditions.append("mod_sigla = :mod_sigla")
        params["mod_sigla"] = mod_sigla.strip().upper()

    if chave_filter:
        conditions.append("chave ILIKE :chave")
        params["chave"] = f"%{chave_filter.strip().upper()}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = (
        f'SELECT id, mod_code, mod_sigla, chave, tabela, nome, schema_json, updated_at '
        f'FROM "{clean_tenant}".tenant_schemas {where} ORDER BY mod_code, chave'
    )
    try:
        return list(db.execute(text(sql), params).mappings().all())
    except Exception as e:
        logger.error(f"Erro ao ler tenant_schemas de {clean_tenant}: {e}")
        return []


def _parse_schema_json(raw) -> dict:
    if isinstance(raw, str):
        try: return json.loads(raw)
        except: return {}
    return raw or {}


def _existing_columns(db: Session, schema_name: str, table_name: str) -> set[str]:
    rows = db.execute(
        text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema_name
              AND table_name = :table_name
        """),
        {"schema_name": schema_name, "table_name": table_name},
    ).scalars().all()
    return {str(column) for column in rows}


def _role_storage_id(db: Session, role_id: str) -> str:
    clean_role = str(role_id or "").strip()
    if not clean_role:
        raise HTTPException(status_code=400, detail="role_id é obrigatório para editar permissões.")
    role_code = db.execute(
        text("SELECT role_code FROM public.roles WHERE id::text = :role_id LIMIT 1"),
        {"role_id": clean_role},
    ).scalar()
    return str(role_code).strip() if role_code else clean_role


# ─── Admin: Snapshot / Sincronização ─────────────────────────────────────────

@router.post("/api/admin/dictionary/snapshot", summary="Aciona sincronização do dicionário Protheus (V5)")
async def trigger_dictionary_snapshot(
    req: SnapshotRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    """Sincroniza o dicionário real do ambiente Protheus informado."""
    environment_code = req.environment_id.strip()
    if environment_code.lower() in {"default", "none", "null"}:
        raise HTTPException(
            status_code=400,
            detail="environment_id deve identificar um ambiente Protheus real.",
        )

    module_filter = [module.strip() for module in (req.modules or []) if module and module.strip()]
    snapshot_kwargs = {
        "tenant_id": req.tenant_id.strip(),
        "environment_code": environment_code,
        "company_id": req.company_id,
        "session": None,
        "module_filter": module_filter or None,
    }

    if req.async_mode:
        background_tasks.add_task(run_snapshot, **snapshot_kwargs)
        return {
            "status": "processing",
            "message": "Sincronização do dicionário acionada para o ambiente informado.",
            "tenant_id": req.tenant_id,
            "environment_id": environment_code,
        }

    try:
        result = await asyncio.to_thread(run_snapshot, **snapshot_kwargs)
        return {
            "status": result.get("status", "done") if isinstance(result, dict) else "done",
            "tenant_id": req.tenant_id,
            "environment_id": environment_code,
            "result": result,
        }
    except RuntimeError as exc:
        logger.error("Erro na sincronização do dicionário: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Falha inesperada no snapshot: %s", type(exc).__name__)
        raise HTTPException(
            status_code=500,
            detail="Erro interno ao sincronizar o dicionário real.",
        ) from exc




# ─── Admin: Listagem de Tabelas e Campos ──────────────────────────────────────

@router.get("/api/admin/dictionary/tables", summary="Lista tabelas sincronizadas (V5: tenant_schemas)")
def get_dictionary_tables(
    tenant_id:  str           = Query(..., description="ID do tenant"),
    mod_sigla:  Optional[str] = Query(None, description="Filtrar por sigla do módulo (ex: SIGAFIN)"),
    table_name: Optional[str] = Query(None, description="Filtrar por chave da tabela (ex: SA1)"),
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    """
    Retorna tabelas e campos carregados no schema do tenant.
    Os campos individuais estão dentro de schema_json.campos[].
    """
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    rows = _read_tenant_schemas(db, clean_tenant, mod_sigla=mod_sigla, chave_filter=table_name)

    result = []

    for r in rows:
        sj = _parse_schema_json(r["schema_json"])
        campos = sj.get("campos", [])
        result.append({
            "mod_code":         r["mod_code"],
            "mod_sigla":        r["mod_sigla"],
            "chave":            r["chave"],
            "tabela":           r["tabela"] or "",
            "nome":             r["nome"] or "",
            "compartilhamento": sj.get("compartilhamento", {}),
            "total_campos":     len(campos),
            "campos": [
                {
                    "campo":    c.get("campo", ""),
                    "descricao":c.get("descricao", ""),
                    "tipo":     c.get("tipo", ""),
                    "tamanho":  c.get("tamanho", 0),
                }
                for c in campos
            ],
        })

    return {
        "status":    "success",
        "tenant_id": tenant_id,
        "total":     len(result),
        "tables":    result,
    }


# ─── Admin: Histórico de Sincronizações ──────────────────────────────────────

@router.get("/api/admin/snapshots", summary="Resumo de sincronizações por módulo (V5)")
def list_snapshots(
    tenant_id: str = Query(..., description="ID do tenant"),
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    """
    Retorna resumo das sincronizações agrupadas por módulo.
    Na V5, cada sync atualiza tenant_schemas — exibe total de tabelas e última atualização.
    """
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    try:
        rows = db.execute(
            text(f"""
                SELECT mod_code, mod_sigla,
                       COUNT(DISTINCT chave) AS total_tabelas,
                       MAX(updated_at)       AS ultima_atualizacao
                FROM "{clean_tenant}".tenant_schemas
                GROUP BY mod_code, mod_sigla
                ORDER BY mod_code
            """)
        ).mappings().all()

        snapshots = [
            {
                "mod_code":           r["mod_code"],
                "mod_sigla":          r["mod_sigla"],
                "total_tabelas":      r["total_tabelas"],
                "ultima_atualizacao": str(r["ultima_atualizacao"]) if r["ultima_atualizacao"] else None,
            }
            for r in rows
        ]
        return {
            "status":         "success",
            "tenant_id":      tenant_id,
            "total_modulos":  len(snapshots),
            "snapshots":      snapshots,
        }
    except Exception as e:
        logger.error(f"Erro ao listar snapshots de {clean_tenant}: {e}")
        return {"status": "success", "tenant_id": tenant_id, "snapshots": []}


# ─── Agente: Catálogo Completo (V5) ──────────────────────────────────────────

def _build_agent_catalog(db: Session, tenant_id: str, mod_sigla: Optional[str], table_filter: Optional[str]) -> Dict[str, Any]:
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    rows = _read_tenant_schemas(db, clean_tenant, mod_sigla=mod_sigla, chave_filter=table_filter)

    catalog: Dict[str, Any] = {}
    for r in rows:
        sj = _parse_schema_json(r["schema_json"])
        campos = sj.get("campos", [])
        chave = r["chave"]
        catalog[chave] = {
            "mod_code":         r["mod_code"],
            "mod_sigla":        r["mod_sigla"],
            "tabela":           r["tabela"] or chave,
            "descricao":        r["nome"] or "",
            "compartilhamento": sj.get("compartilhamento", {}),
            "campos": {
                c.get("campo", ""): {
                    "descricao": c.get("descricao", ""),
                    "tipo":      c.get("tipo", ""),
                    "tamanho":   c.get("tamanho", 0),
                }
                for c in campos if c.get("campo")
            },
        }

    return {
        "status":        "success",
        "tenant_id":     tenant_id,
        "total_tabelas": len(catalog),
        "total_campos":  sum(len(v["campos"]) for v in catalog.values()),
        "catalog":       catalog,
    }


@router.get("/api/agent/catalog/allowed", summary="Catálogo permitido para o Agente (V5 — GET)")
def read_agent_catalog_get(
    tenant_id:    str           = Query(..., description="ID do tenant"),
    mod_sigla:    Optional[str] = Query(None, description="Filtrar por sigla do módulo"),
    table_filter: Optional[str] = Query(None, description="Filtrar por chave de tabela"),
    db: Session = Depends(get_db),
):
    """
    Retorna o catálogo de tabelas e campos para o agente Copilot.
    Na V5, o catálogo permitido = tudo que está em tenant_schemas.
    Sem filtro por role — o schema do tenant isola os dados por empresa.
    """
    return _build_agent_catalog(db, tenant_id, mod_sigla=mod_sigla, table_filter=table_filter)


@router.post("/api/agent/catalog/allowed", summary="Catálogo permitido para o Agente (V5 — POST)")
def read_agent_catalog_post(req: CatalogRequest, db: Session = Depends(get_db)):
    return _build_agent_catalog(db, req.tenant_id, mod_sigla=req.mod_sigla, table_filter=req.table_filter)


