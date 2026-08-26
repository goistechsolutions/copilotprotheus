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


# ─── Admin: Permissões relacionais de tabela/campo ─────────────────────────────


def _permission_scope_where(columns: set[str], role_id: str | None, environment_id: str | None, company_id: str | None) -> tuple[list[str], dict[str, Any]]:
    conditions = ["btrim(tenant_id) = :tenant_id"]
    params: dict[str, Any] = {}
    if environment_id and "environment_id" in columns:
        conditions.append("environment_id = :environment_id")
        params["environment_id"] = environment_id.strip()
    if role_id and "role_id" in columns:
        conditions.append("(btrim(role_id) = :role_id OR lower(btrim(role_id)) = lower(btrim((SELECT role_code FROM public.roles WHERE id::text = :role_id LIMIT 1))))")
        params["role_id"] = role_id.strip()
    if "company_id" in columns:
        if company_id:
            conditions.append("company_id::text = :company_id")
            params["company_id"] = company_id.strip()
        else:
            conditions.append("company_id IS NULL")
    return conditions, params


def _permission_select(columns: set[str], names: list[str]) -> str:
    return ", ".join(name if name in columns else f"NULL AS {name}" for name in names)


@router.get("/api/admin/permissions", summary="Lista permissões relacionais do tenant")
def get_table_permissions(
    tenant_id: str = Query(..., min_length=1),
    environment_id: Optional[str] = Query(None),
    role_id: Optional[str] = Query(None),
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin),
):
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    table_columns = _existing_columns(db, clean_tenant, "tenant_table_permissions")
    field_columns = _existing_columns(db, clean_tenant, "tenant_field_permissions")
    if "table_name" not in table_columns:
        return {"status": "unavailable", "tenant_id": tenant_id, "tables": [], "fields": [], "message": "A matriz de permissões ainda não foi criada para este tenant."}

    table_where, params = _permission_scope_where(table_columns, role_id, environment_id, company_id)
    params["tenant_id"] = tenant_id.strip()
    table_rows = db.execute(
        text(f"""
            SELECT {_permission_select(table_columns, ['table_name', 'environment_id', 'role_id', 'company_id', 'can_list', 'can_describe', 'can_query'])}
            FROM \"{clean_tenant}\".tenant_table_permissions
            WHERE {' AND '.join(table_where)}
            ORDER BY table_name
        """),
        params,
    ).mappings().all()
    tables = [dict(row) for row in table_rows]

    fields = []
    if "table_name" in field_columns and "field_name" in field_columns:
        field_where, field_params = _permission_scope_where(field_columns, role_id, environment_id, company_id)
        field_params["tenant_id"] = tenant_id.strip()
        field_rows = db.execute(
            text(f"""
                SELECT {_permission_select(field_columns, ['table_name', 'field_name', 'environment_id', 'role_id', 'company_id', 'can_select', 'can_filter', 'masked_flag'])}
                FROM \"{clean_tenant}\".tenant_field_permissions
                WHERE {' AND '.join(field_where)}
                ORDER BY table_name, field_name
            """),
            field_params,
        ).mappings().all()
        fields = [dict(row) for row in field_rows]

    return {"status": "success", "tenant_id": tenant_id, "tables": tables, "fields": fields}


@router.post("/api/admin/permissions", summary="Substitui permissões relacionais de uma tabela")
def save_table_permissions(
    req: SaveTablePermissionRequest,
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin),
):
    clean_tenant = resolve_clean_tenant(db, req.tenant_id)
    table_columns = _existing_columns(db, clean_tenant, "tenant_table_permissions")
    field_columns = _existing_columns(db, clean_tenant, "tenant_field_permissions")
    required_table = {"tenant_id", "environment_id", "role_id", "table_name", "can_list", "can_describe", "can_query"}
    if not required_table.issubset(table_columns):
        raise HTTPException(status_code=409, detail="A matriz de permissões de tabelas não está disponível para este tenant.")
    if req.field_permissions and not {"tenant_id", "environment_id", "role_id", "table_name", "field_name", "can_select", "can_filter", "masked_flag"}.issubset(field_columns):
        raise HTTPException(status_code=409, detail="A matriz de permissões de campos não está disponível para este tenant.")

    storage_role_id = _role_storage_id(db, req.role_id)
    scope = {
        "tenant_id": req.tenant_id.strip(),
        "environment_id": req.environment_id.strip(),
        "role_id": storage_role_id,
        "table_name": req.table_name.strip().upper(),
        "company_id": req.company_id,
    }
    if not scope["tenant_id"] or not scope["environment_id"] or not scope["table_name"]:
        raise HTTPException(status_code=400, detail="tenant_id, environment_id e table_name são obrigatórios.")

    table_columns_to_write = ["tenant_id", "environment_id", "role_id", "table_name", "can_list", "can_describe", "can_query"]
    table_values = {**scope, "can_list": req.can_list, "can_describe": req.can_describe, "can_query": req.can_query}
    if "company_id" in table_columns:
        table_columns_to_write.append("company_id")
    else:
        table_columns_to_write.remove("company_id") if "company_id" in table_columns_to_write else None
        table_values.pop("company_id", None)
    if "approved_by" in table_columns:
        table_columns_to_write.append("approved_by")
        table_values["approved_by"] = req.approved_by

    try:
        table_scope = "tenant_id = :tenant_id AND environment_id = :environment_id AND role_id = :role_id AND table_name = :table_name"
        if "company_id" in table_columns:
            table_scope += " AND company_id IS NOT DISTINCT FROM :company_id"
        db.execute(text(f'DELETE FROM "{clean_tenant}".tenant_table_permissions WHERE {table_scope}'), scope)
        columns_sql = ", ".join(table_columns_to_write)
        values_sql = ", ".join(f":{column}" for column in table_columns_to_write)
        db.execute(text(f'INSERT INTO "{clean_tenant}".tenant_table_permissions ({columns_sql}) VALUES ({values_sql})'), table_values)

        if "field_name" in field_columns:
            db.execute(text(f'DELETE FROM "{clean_tenant}".tenant_field_permissions WHERE {table_scope}'), scope)
            field_columns_to_write = ["tenant_id", "environment_id", "role_id", "table_name", "field_name", "can_select", "can_filter", "masked_flag"]
            if "company_id" in field_columns:
                field_columns_to_write.append("company_id")
            for field in req.field_permissions:
                field_values = {
                    **scope,
                    "field_name": field.field_name.strip().upper(),
                    "can_select": field.can_select,
                    "can_filter": field.can_filter,
                    "masked_flag": field.masked_flag,
                }
                if "company_id" not in field_columns:
                    field_values.pop("company_id", None)
                field_columns_sql = ", ".join(field_columns_to_write)
                field_values_sql = ", ".join(f":{column}" for column in field_columns_to_write)
                db.execute(text(f'INSERT INTO "{clean_tenant}".tenant_field_permissions ({field_columns_sql}) VALUES ({field_values_sql})'), field_values)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Falha ao salvar permissões relacionais: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Não foi possível salvar as permissões relacionais.") from exc

    return {"status": "success", "tenant_id": req.tenant_id, "environment_id": req.environment_id, "role_id": storage_role_id, "table_name": scope["table_name"]}


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


