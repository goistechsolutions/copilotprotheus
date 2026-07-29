from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from app.db.database import get_db
from app.core.auth import get_current_user
from app.api.admin_routes import verify_admin
from app.models.catalog_v52 import (
    TenantDictionarySource, DictionaryTable, DictionaryField, 
    DictionaryIndex, DictionaryGroup, TenantTablePermission, TenantFieldPermission
)
from app.services.catalog_service_v52 import get_allowed_catalog, get_structured_catalog_by_role
from app.services.sync_dictionary_v52 import run_snapshot

logger = logging.getLogger("app.api.catalog_v52")

router = APIRouter(tags=["catalog-v52-governance"])

# --- Modelos de Request / Response ---

class SnapshotRequest(BaseModel):
    tenant_id: str = Field(..., description="ID do tenant (padrão 'default')")
    environment_id: str = Field("producao", description="ID do ambiente Protheus")
    company_id: Optional[str] = Field(None, description="ID opcional da empresa/filial")
    snapshot_code: Optional[str] = Field(None, description="Código opcional do snapshot (timestamp por padrão)")
    async_mode: bool = Field(False, description="Executar em segundo plano")

class FieldPermissionItem(BaseModel):
    field_name: str
    can_select: bool = True
    can_filter: bool = True
    masked_flag: bool = False

class SaveTablePermissionRequest(BaseModel):
    tenant_id: str
    environment_id: str = "producao"
    role_id: str
    table_name: str
    can_list: bool = True
    can_describe: bool = True
    can_query: bool = True
    approved_by: Optional[str] = None
    field_permissions: List[FieldPermissionItem] = []

class AllowedCatalogRequest(BaseModel):
    tenant_id: str
    environment_id: str = "producao"
    role_ids: List[str]

# --- Endpoints Admin (Governança e Dicionário) ---

@router.post("/api/admin/dictionary/snapshot", summary="Dispara sincronização do dicionário SX2/SX3/SXG/SIX do Protheus Real")
def trigger_dictionary_snapshot(
    req: SnapshotRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin)
):
    """
    Aciona a leitura e gravação dos metadados estruturais do ambiente Protheus.
    Obedece estritamente às Diretrizes Globais:
    - Não armazena dados transacionais
    - Reporta erro se o Protheus real estiver fora do ar sem inventar dados
    - Prioriza consulta via QueryRest se endpoints REST específicos do framework estiverem ausentes.
    """
    if req.async_mode:
        background_tasks.add_task(run_snapshot, req.tenant_id, req.environment_id, req.company_id, req.snapshot_code)
        return {"status": "processing", "message": "Job de snapshot acionado em background para o ambiente real."}
    else:
        try:
            result = run_snapshot(req.tenant_id, req.environment_id, req.company_id, req.snapshot_code, session=db)
            return result
        except RuntimeError as rt_err:
            logger.error(f"Erro na sincronização de dicionário: {rt_err}")
            raise HTTPException(
                status_code=502, 
                detail=str(rt_err)
            )
        except Exception as e:
            logger.error(f"Falha inesperada no snapshot: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Erro interno ao sincronizar dicionário real: {str(e)}"
            )

@router.get("/api/admin/dictionary/tables", summary="Lista tabelas e campos sincronizados no catálogo")
def get_dictionary_tables(
    tenant_id: str = Query(..., description="ID do Tenant"),
    environment_id: str = Query("producao", description="Ambiente"),
    company_id: Optional[int] = Query(None, description="Filtrar por ID de empresa"),
    module_filter: Optional[List[str]] = Query(None, description="Filtrar por códigos de módulo Protheus"),
    table_name: Optional[str] = Query(None, description="Filtrar por tabela (ex: SC5, SD2)"),
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin)
):
    import re
    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    query_tbl = db.query(DictionaryTable).filter(
        DictionaryTable.tenant_id == tenant_id,
        DictionaryTable.environment_id == environment_id,
        DictionaryTable.active_flag == True
    )
    if company_id is not None:
        comp_str = str(company_id)
        query_tbl = query_tbl.filter((DictionaryTable.company_id == comp_str) | (DictionaryTable.company_id == None) | (DictionaryTable.company_id == ''))
    if module_filter:
        query_tbl = query_tbl.filter(DictionaryTable.module_code.in_(module_filter))
    if table_name:
        query_tbl = query_tbl.filter(DictionaryTable.table_name.ilike(f"%{table_name.strip().upper()}%"))
    
    tables = query_tbl.order_by(DictionaryTable.module_code.asc(), DictionaryTable.table_name.asc()).all()
    
    result = []
    for t in tables:
        fields = db.query(DictionaryField).filter(
            DictionaryField.tenant_id == tenant_id,
            DictionaryField.environment_id == environment_id,
            DictionaryField.table_name == t.table_name,
            DictionaryField.snapshot_code == t.snapshot_code
        ).order_by(DictionaryField.field_name.asc()).all()
        
        result.append({
            "table_name": t.table_name,
            "table_alias": t.table_alias,
            "description": t.description,
            "module_code": t.module_code,
            "snapshot_code": t.snapshot_code,
            "fields": [
                {
                    "field_name": f.field_name,
                    "title": f.title,
                    "type": f.field_type,
                    "length": f.length_num,
                    "decimal": f.decimal_num,
                    "required": f.required_flag
                }
                for f in fields
            ]
        })
    return {
        "status": "success",
        "tenant_id": tenant_id, 
        "environment_id": environment_id, 
        "count": len(result), 
        "tables": result,
        "items": result
    }

@router.get("/api/admin/dictionary/permissions", summary="Consulta permissões granulares configuradas para uma Role")
def list_role_permissions(
    tenant_id: str = Query(...),
    role_id: str = Query(...),
    environment_id: str = Query("producao"),
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin)
):
    tables = db.query(TenantTablePermission).filter(
        TenantTablePermission.tenant_id == tenant_id,
        TenantTablePermission.environment_id == environment_id,
        TenantTablePermission.role_id == role_id
    ).all()
    
    res = []
    for t in tables:
        fields = db.query(TenantFieldPermission).filter(
            TenantFieldPermission.tenant_id == tenant_id,
            TenantFieldPermission.environment_id == environment_id,
            TenantFieldPermission.role_id == role_id,
            TenantFieldPermission.table_name == t.table_name
        ).all()
        res.append({
            "table_name": t.table_name,
            "can_list": t.can_list,
            "can_describe": t.can_describe,
            "can_query": t.can_query,
            "field_permissions": [
                {
                    "field_name": f.field_name,
                    "can_select": f.can_select,
                    "can_filter": f.can_filter,
                    "masked_flag": f.masked_flag
                } for f in fields
            ]
        })
    return {"tenant_id": tenant_id, "role_id": role_id, "environment_id": environment_id, "permissions": res}

@router.post("/api/admin/dictionary/permissions", summary="Salva permissões de tabela e campo por role")
def save_table_permission(
    req: SaveTablePermissionRequest,
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin)
):
    table_perm = db.query(TenantTablePermission).filter(
        TenantTablePermission.tenant_id == req.tenant_id,
        TenantTablePermission.environment_id == req.environment_id,
        TenantTablePermission.role_id == req.role_id,
        TenantTablePermission.table_name == req.table_name.upper()
    ).first()
    
    if not table_perm:
        table_perm = TenantTablePermission(
            tenant_id=req.tenant_id,
            environment_id=req.environment_id,
            role_id=req.role_id,
            table_name=req.table_name.upper()
        )
        db.add(table_perm)
    
    table_perm.can_list = req.can_list
    table_perm.can_describe = req.can_describe
    table_perm.can_query = req.can_query
    table_perm.approved_by = req.approved_by
    
    for f in req.field_permissions:
        field_perm = db.query(TenantFieldPermission).filter(
            TenantFieldPermission.tenant_id == req.tenant_id,
            TenantFieldPermission.environment_id == req.environment_id,
            TenantFieldPermission.role_id == req.role_id,
            TenantFieldPermission.table_name == req.table_name.upper(),
            TenantFieldPermission.field_name == f.field_name.upper()
        ).first()
        if not field_perm:
            field_perm = TenantFieldPermission(
                tenant_id=req.tenant_id,
                environment_id=req.environment_id,
                role_id=req.role_id,
                table_name=req.table_name.upper(),
                field_name=f.field_name.upper()
            )
            db.add(field_perm)
        field_perm.can_select = f.can_select
        field_perm.can_filter = f.can_filter
        field_perm.masked_flag = f.masked_flag
        field_perm.approved_by = req.approved_by
        
    db.commit()
    return {"status": "success", "message": f"Permissões da tabela {req.table_name} atualizadas para a role {req.role_id}."}

# --- Endpoints Agente (Leitura e Enforcement do Catálogo) ---

@router.post("/api/agent/catalog/allowed", summary="Retorna dicionário liberado para as roles (Enforcement Pré-SQL)")
def read_allowed_catalog_post(req: AllowedCatalogRequest, db: Session = Depends(get_db)):
    """
    Endpoint consumido pelo Agente Copilot antes da elaboração e execução das queries SQL.
    Expõe unicamente os tabelas, relacionamentos e campos nos quais as roles possuem autorização,
    evitando alucinações e queries ilegais ao banco de dados Protheus Oracle.
    """
    try:
        catalog_structured = get_structured_catalog_by_role(db, req.tenant_id, req.environment_id, req.role_ids)
        raw_rows = get_allowed_catalog(db, req.tenant_id, req.environment_id, req.role_ids)
        return {
            "status": "success",
            "tenant_id": req.tenant_id,
            "environment_id": req.environment_id,
            "total_allowed_fields": len(raw_rows),
            "catalog": catalog_structured
        }
    except Exception as e:
        logger.error(f"Erro ao consultar catálogo liberado do agente: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter catálogo governado: {str(e)}")

@router.get("/api/agent/catalog/allowed", summary="Retorna dicionário liberado via GET (Enforcement)")
def read_allowed_catalog_get(
    tenant_id: str = Query(..., description="ID do tenant"),
    environment_id: str = Query("producao", description="ID do ambiente"),
    role_ids: str = Query(..., description="IDs de role separados por vírgula (ex: 1,admin)"),
    db: Session = Depends(get_db)
):
    roles_list = [r.strip() for r in role_ids.split(",") if r.strip()]
    return read_allowed_catalog_post(
        AllowedCatalogRequest(tenant_id=tenant_id, environment_id=environment_id, role_ids=roles_list),
        db=db
    )
