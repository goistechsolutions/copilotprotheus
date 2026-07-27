"""Rotas administrativas — modelo V4 canônico.

Migracoes V2 -> V4:
  AllowedTable         -> TenantAllowedTable
  ProtheusModule       -> ProtheusModuleMaster
  AgentUser            -> User  (UUID, RBAC, Fernet)
  AgentRole            -> Role  (scope_level, role_code)
  api_usage_logs       -> AgentQueryAudit + QueryUsageCounter

Seguranca:
  - /agent-users e /agent-roles REMOVIDOS — gerenciados por auth_routes (/register, /users).
  - Senhas nunca em claro. Uso de Fernet via FERNET_KEY.
  - ADMIN_USER / ADMIN_PASSWORD via env.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import json
import dotenv
import hashlib
import uuid
from pathlib import Path

from app.db.database import get_db
from app.models.knowledge import (
    AuditLog, Tenant, Company,
    TenantAllowedTable, TenantContract, DictionarySnapshot, TenantDictionaryTable,
    ProtheusModuleMaster,
    User, Role, user_roles,
    TenantSchema,
    Memory,
    AgentQueryAudit, QueryUsageCounter,
)
from app.core.config import settings

router = APIRouter()
security = HTTPBasic()

ENV_PATH = Path(".env")

# ─────────────────────────────────────────────────────────────
# Autenticacao administrativa (HTTP Basic via ADMIN_USER/PASS)
# ─────────────────────────────────────────────────────────────

def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais de administrador invalidas",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ─────────────────────────────────────────────────────────────
# CONFIG (.env)
# ─────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    key: str
    value: str

@router.get("/config")
def get_config(admin: str = Depends(verify_admin)):
    """Retorna chaves do .env — oculta segredos de tenant e senhas."""
    config_dict = dotenv.dotenv_values(ENV_PATH)
    keys_to_hide = [
        "PROTHEUS_REST_URL", "PROTHEUS_USER", "PROTHEUS_PASSWORD",
        "PROTHEUS_URL", "PROTHEUS_ENVIRONMENT", "WEBAPP_URL",
        "FERNET_KEY", "JWT_SECRET", "ADMIN_PASSWORD",
    ]
    for k in keys_to_hide:
        config_dict.pop(k, None)
    default_keys = [
        "R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
        "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_API_TOKEN", "HETZNER_API_TOKEN",
        "LLM_BACKEND", "GEMINI_MODEL", "GEMINI_API_KEY",
        "OLLAMA_MODEL", "OLLAMA_BASE_URL",
    ]
    for key in default_keys:
        if key not in config_dict:
            config_dict[key] = ""
    return {"configs": config_dict}


@router.post("/config")
def update_config(update: ConfigUpdate, admin: str = Depends(verify_admin)):
    """Atualiza uma chave no .env e em os.environ."""
    config_dict = dotenv.dotenv_values(ENV_PATH)
    config_dict[update.key] = update.value
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        for k, v in config_dict.items():
            if v is not None:
                f.write(f"{k}='{str(v).replace(chr(10), chr(92)+'n')}'\n")
            else:
                f.write(f"{k}=\n")
    os.environ[update.key] = update.value
    key_lower = update.key.lower()
    if hasattr(settings, key_lower):
        setattr(settings, key_lower, update.value)
    return {"success": True, "message": f"Chave {update.key} atualizada."}


# ─────────────────────────────────────────────────────────────
# TABELAS PERMITIDAS  (V4: TenantAllowedTable)
# ─────────────────────────────────────────────────────────────

# Tabelas padrao exibidas quando o tenant ainda nao configurou nada
DEFAULT_TABLES = [
    {"alias": "SF2010", "description": "FATURAMENTO/VENDAS",         "fields": "F2_FILIAL,F2_DOC,F2_SERIE,F2_CLIENTE,F2_LOJA,F2_EMISSAO,F2_VALBRUT", "tipo": "Cabecalho"},
    {"alias": "SD2010", "description": "FATURAMENTO/VENDAS (Itens)",  "fields": "D2_FILIAL,D2_DOC,D2_COD,D2_QUANT,D2_TOTAL,D2_EMISSAO",              "tipo": "Itens"},
    {"alias": "SF1010", "description": "ENTRADAS/COMPRAS",            "fields": "F1_FILIAL,F1_DOC,F1_SERIE,F1_FORNECE,F1_LOJA,F1_EMISSAO,F1_VALBRUT", "tipo": "Cabecalho"},
    {"alias": "SD1010", "description": "ENTRADAS/COMPRAS (Itens)",    "fields": "D1_FILIAL,D1_DOC,D1_COD,D1_QUANT,D1_TOTAL,D1_EMISSAO",              "tipo": "Itens"},
    {"alias": "SA1010", "description": "CLIENTES",                     "fields": "A1_COD,A1_NOME,A1_LC,A1_MSBLQL",                                   "tipo": "Cadastro"},
    {"alias": "SA2010", "description": "FORNECEDORES",                 "fields": "A2_COD,A2_NOME",                                                   "tipo": "Cadastro"},
    {"alias": "SB1010", "description": "PRODUTOS",                     "fields": "B1_COD,B1_DESC",                                                   "tipo": "Cadastro"},
    {"alias": "SB2010", "description": "SALDOS",                       "fields": "B2_COD,B2_QATU",                                                   "tipo": "Saldo"},
    {"alias": "SE1010", "description": "CONTAS A RECEBER",             "fields": "E1_NUM,E1_CLIENTE,E1_VENCTO,E1_VALOR,E1_SALDO",                   "tipo": "Financeiro"},
    {"alias": "SE2010", "description": "CONTAS A PAGAR",               "fields": "E2_NUM,E2_FORNECE,E2_VENCTO,E2_VALOR,E2_SALDO",                   "tipo": "Financeiro"},
]


def _get_active_contract(db: Session, tenant_id: str) -> Optional[TenantContract]:
    """Retorna o contrato ativo mais recente do tenant."""
    return (
        db.query(TenantContract)
        .filter(
            TenantContract.tenant_id == tenant_id,
            TenantContract.contract_status == 'active',
        )
        .order_by(TenantContract.starts_at.desc())
        .first()
    )


def _get_latest_snapshot(db: Session, tenant_id: str) -> Optional[DictionarySnapshot]:
    """Retorna o snapshot de dicionario mais recente do tenant."""
    return (
        db.query(DictionarySnapshot)
        .filter(
            DictionarySnapshot.tenant_id == tenant_id,
            DictionarySnapshot.sync_status == 'completed',
        )
        .order_by(DictionarySnapshot.finished_at.desc())
        .first()
    )


@router.get("/tables")
def get_tables(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(verify_admin),
):
    """Retorna tabelas permitidas (V4: tenant_allowed_tables)."""
    contract = _get_active_contract(db, tenant_id)
    if not contract:
        return {"tables": DEFAULT_TABLES, "source": "default"}

    rows = (
        db.query(TenantAllowedTable, TenantDictionaryTable)
        .join(TenantDictionaryTable, TenantAllowedTable.table_id == TenantDictionaryTable.id)
        .filter(
            TenantAllowedTable.tenant_id == tenant_id,
            TenantAllowedTable.contract_id == contract.id,
            TenantAllowedTable.allowed == True,
        )
        .all()
    )

    if not rows:
        return {"tables": DEFAULT_TABLES, "source": "default"}

    result = [
        {
            "id":          str(at.id),
            "alias":       dt.table_key,
            "description": dt.table_name,
            "tipo":        dt.module_code or "",
            "fields":      "",           # campos detalhados via /schemas
            "access_level":at.access_level,
        }
        for at, dt in rows
    ]
    return {"tables": result, "source": "v4", "contract_id": str(contract.id)}


class TableItem(BaseModel):
    alias:       str
    description: str = ""
    tipo:        str = ""
    fields:      str = ""
    access_level:str = "query"


@router.post("/tables")
def update_tables(
    tables: List[TableItem] = Body(...),
    tenant_id: str           = Body(..., embed=True),
    db: Session              = Depends(get_db),
    admin: str               = Depends(verify_admin),
):
    """Atualiza tabelas permitidas no modelo V4 (tenant_allowed_tables)."""
    contract = _get_active_contract(db, tenant_id)
    if not contract:
        raise HTTPException(
            status_code=400,
            detail="Nenhum contrato ativo encontrado para o tenant. Crie um TenantContract primeiro.",
        )
    snapshot = _get_latest_snapshot(db, tenant_id)
    if not snapshot:
        raise HTTPException(
            status_code=400,
            detail="Nenhum snapshot de dicionario encontrado. Execute /sync-schema antes de configurar tabelas.",
        )

    # Remove permissoes antigas deste contrato
    db.query(TenantAllowedTable).filter(
        TenantAllowedTable.tenant_id   == tenant_id,
        TenantAllowedTable.contract_id == contract.id,
    ).delete(synchronize_session=False)

    for t in tables:
        # Localiza tabela no dicionario pelo alias/table_key
        dict_table = (
            db.query(TenantDictionaryTable)
            .filter(
                TenantDictionaryTable.tenant_id  == tenant_id,
                TenantDictionaryTable.snapshot_id == snapshot.id,
                TenantDictionaryTable.table_key   == t.alias,
            )
            .first()
        )
        if not dict_table:
            # Cria entrada minima no dicionario para nao bloquear o admin
            dict_table = TenantDictionaryTable(
                snapshot_id=snapshot.id,
                tenant_id=tenant_id,
                table_key=t.alias,
                physical_name=t.alias[:30],
                table_name=t.description,
                module_code=t.tipo or None,
            )
            db.add(dict_table)
            db.flush()

        db.add(TenantAllowedTable(
            tenant_id   =tenant_id,
            contract_id =contract.id,
            snapshot_id =snapshot.id,
            table_id    =dict_table.id,
            access_level=t.access_level,
            allowed     =True,
            rationale   =t.description,
        ))

    db.commit()
    return {"success": True, "message": f"{len(tables)} tabelas atualizadas (V4)."}


# ─────────────────────────────────────────────────────────────
# SYNC MODULOS  (V4: ProtheusModuleMaster)
# ─────────────────────────────────────────────────────────────

@router.post("/sync-modules")
async def sync_modules(
    payload: dict     = Body(...),
    db: Session       = Depends(get_db),
    admin: str        = Depends(verify_admin),
):
    """Sincroniza SYS_USR_MODULE -> protheus_modules_master."""
    from app.services.protheus_service import execute_protheus_tool

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id e obrigatorio.")

    modules_query = (
        "/* %notparser% */ SELECT DISTINCT USR_MODULO, USR_CODMOD "
        "FROM SYS_USR_MODULE WHERE D_E_L_E_T_<>'*' ORDER BY USR_MODULO"
    )
    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": modules_query}, tenant_id=tenant_id)
        result_data  = json.loads(response_str)
        if isinstance(result_data, dict):
            result_data = result_data.get("items") or result_data.get("data", [])
        if not isinstance(result_data, list):
            raise Exception(f"Retorno inesperado: {str(result_data)[:200]}")

        def _val(row: dict, key: str) -> str:
            if not isinstance(row, dict): return ""
            v = row.get(key)
            if v is not None: return str(v).strip()
            for k, val in row.items():
                if k.strip().upper() == key.upper():
                    return "" if val is None else str(val).strip()
            return ""

        count = 0
        for row in result_data:
            mod_code = _val(row, "USR_CODMOD")
            mod_name = _val(row, "USR_MODULO")
            if not mod_code:
                continue
            existing = db.query(ProtheusModuleMaster).filter(
                ProtheusModuleMaster.module_code == mod_code
            ).first()
            if existing:
                existing.module_name = mod_name or existing.module_name
                existing.active      = True
            else:
                db.add(ProtheusModuleMaster(
                    module_code=mod_code,
                    module_name=mod_name or mod_code,
                    source_name="SYS_USR_MODULE",
                ))
            count += 1

        db.commit()
        return {"success": True, "message": f"{count} modulos sincronizados em protheus_modules_master."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/protheus-modules")
def get_protheus_modules(
    tenant_id: str,
    db: Session   = Depends(get_db),
    admin: str    = Depends(verify_admin),
):
    """Lista modulos do catalogo global (protheus_modules_master)."""
    modules = (
        db.query(ProtheusModuleMaster)
        .filter(ProtheusModuleMaster.active == True)
        .order_by(ProtheusModuleMaster.module_code)
        .all()
    )
    return {
        "modules": [
            {"module_code": m.module_code, "module_name": m.module_name}
            for m in modules
        ]
    }


# ─────────────────────────────────────────────────────────────
# SYNC SCHEMA  (V4: TenantSchema + DictionarySnapshot)
# ─────────────────────────────────────────────────────────────

@router.post("/sync-schema")
async def sync_schema(
    payload: dict = Body(...),
    db: Session   = Depends(get_db),
    admin: str    = Depends(verify_admin),
):
    from app.services.protheus_service import execute_protheus_tool

    def fix_json_escapes(raw: str) -> str:
        s = raw.replace('\\', '\\\\')
        return s.replace('\\\\"', '\\"')

    tenant_id = payload.get("tenant_id")
    modulos   = payload.get("modulos", [])
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id e obrigatorio.")

    import re
    clean_modulos = [m.strip().upper() for m in modulos if isinstance(m, str) and m.strip()]
    if not clean_modulos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um modulo.")

    # Resolve codigos numericos via ProtheusModuleMaster
    db_mods = (
        db.query(ProtheusModuleMaster)
        .filter(ProtheusModuleMaster.module_code.in_(clean_modulos))
        .all()
    )

    # Fallback hardcoded TOTVS classico
    if not db_mods:
        fallback_map = {
            "SIGAATF":"01","SIGACOM":"02","SIGAEST":"04","SIGAFAT":"05",
            "SIGAFIN":"06","SIGAGPE":"07","SIGAFIS":"09","SIGAPON":"16",
            "SIGATMK":"31","SIGACTB":"34","SIGAADV":"34","SIGAMNT":"43","SIGAJURI":"76",
        }
        for nome, num in fallback_map.items():
            db.add(ProtheusModuleMaster(
                module_code=nome, module_name=num, source_name="fallback_hardcoded"
            ))
        db.commit()
        db_mods = (
            db.query(ProtheusModuleMaster)
            .filter(ProtheusModuleMaster.module_code.in_(clean_modulos))
            .all()
        )

    mod_codes_list = set()
    code_to_name   = {}
    for m in db_mods:
        num = m.module_name.strip()
        mod_codes_list.add(num)
        code_to_name[num] = m.module_code
        if num.isdigit():
            v = int(num)
            mod_codes_list.update([str(v), f"{v:02d}"])
            code_to_name[str(v)] = m.module_code
            code_to_name[f"{v:02d}"] = m.module_code

    if not mod_codes_list:
        raise HTTPException(
            status_code=400,
            detail=f"Nao foi possivel obter codigos numericos para: {', '.join(clean_modulos)}.",
        )

    numeric_in = ", ".join([f"'{c}'" for c in mod_codes_list])
    tables_query = (
        f"SELECT DISTINCT X2.X2_MODULO,X2.X2_CHAVE,X2.X2_ARQUIVO,X2.X2_NOME,"
        f"X2.X2_TAMFIL,X2.X2_MODO,X2.X2_TAMUN,X2.X2_MODOUN,X2.X2_TAMEMP,X2.X2_MODOEMP,X2.X2_UNICO,"
        f"CASE WHEN X2.X2_MODOEMP='E' AND NVL(X2.X2_TAMEMP,0)>0 THEN 'S' ELSE 'N' END AS USA_EMPRESA,"
        f"CASE WHEN X2.X2_MODOUN='E' AND NVL(X2.X2_TAMUN,0)>0 THEN 'S' ELSE 'N' END AS USA_UNIDADE,"
        f"CASE WHEN X2.X2_MODO='E' AND NVL(X2.X2_TAMFIL,0)>0 THEN 'S' ELSE 'N' END AS USA_FILIAL "
        f"FROM SX2010 X2 INNER JOIN SX3010 X3 ON TRIM(X2.X2_CHAVE)=TRIM(X3.X3_ARQUIVO) AND X3.D_E_L_E_T_<>'*' "
        f"WHERE X2.D_E_L_E_T_<>'*' AND TRIM(X2.X2_MODULO) IN ({numeric_in}) "
        f"ORDER BY X2.X2_MODULO,X2.X2_CHAVE"
    )

    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": tables_query}, tenant_id=tenant_id)
        tables_data  = json.loads(fix_json_escapes(response_str))
        if isinstance(tables_data, dict):
            tables_data = tables_data.get("items") or tables_data.get("data", [])
        if isinstance(tables_data, dict) and "error" in tables_data:
            raise Exception(f"Erro Protheus API: {tables_data['error']}")
        if not isinstance(tables_data, list) or not tables_data:
            raise Exception(f"Nenhuma tabela encontrada para: {', '.join(clean_modulos)}")

        def _fv(row: dict, key: str, default: str = "") -> str:
            if not isinstance(row, dict): return default
            v = row.get(key)
            if v is not None: return str(v).strip()
            for k, val in row.items():
                if k.strip().upper() == key.upper(): return "" if val is None else str(val).strip()
            return default

        # Cria snapshot
        snapshot = DictionarySnapshot(
            tenant_id=tenant_id,
            snapshot_code=f"sync_{'-'.join(clean_modulos)}",
            source_db_type="oracle",
            sync_mode="partial",
            sync_status="in_progress",
            total_modules=len(clean_modulos),
        )
        db.add(snapshot)
        db.flush()

        schema_dict  = {}
        chaves_list  = []
        for row in tables_data:
            chave = _fv(row, "X2_CHAVE")
            if not chave: continue
            chaves_list.append(chave)
            x2_mod   = _fv(row, "X2_MODULO")
            cod_name = code_to_name.get(x2_mod, clean_modulos[0] if clean_modulos else "")
            schema_dict[chave] = {
                "modulo": cod_name,
                "tabela": _fv(row, "X2_ARQUIVO"),
                "nome":   _fv(row, "X2_NOME"),
                "compartilhamento": {
                    "empresa": _fv(row, "USA_EMPRESA", "N"),
                    "unidade": _fv(row, "USA_UNIDADE", "N"),
                    "filial":  _fv(row, "USA_FILIAL",  "N"),
                },
                "indice_principal": _fv(row, "X2_UNICO"),
                "campos": [],
            }

        # Busca campos em lotes de 15
        chunk_size = 15
        for i in range(0, len(chaves_list), chunk_size):
            chunk       = chaves_list[i:i + chunk_size]
            chaves_str  = ", ".join([f"'{c}'" for c in chunk])
            fields_query = (
                f"SELECT X3.X3_ARQUIVO,X3.X3_CAMPO,X3.X3_DESCRIC,X3.X3_TIPO,X3.X3_TAMANHO,X3.X3_ORDEM "
                f"FROM SX3010 X3 WHERE X3.D_E_L_E_T_<>'*' AND X3.X3_ARQUIVO IN ({chaves_str}) "
                f"ORDER BY X3.X3_ARQUIVO,X3.X3_ORDEM,X3.X3_CAMPO"
            )
            fr_str   = await execute_protheus_tool("QueryRest", {"cQuery": fields_query}, tenant_id=tenant_id)
            fd       = json.loads(fix_json_escapes(fr_str))
            if isinstance(fd, dict):
                fd = fd.get("items") or fd.get("data", [])
            if isinstance(fd, list):
                for row in fd:
                    arq = _fv(row, "X3_ARQUIVO")
                    campo = _fv(row, "X3_CAMPO")
                    if arq in schema_dict and campo:
                        try:
                            tam = int(float(_fv(row, "X3_TAMANHO", "0")))
                        except Exception:
                            tam = 0
                        schema_dict[arq]["campos"].append({
                            "campo":    campo,
                            "descricao":_fv(row, "X3_DESCRIC"),
                            "tipo":     _fv(row, "X3_TIPO"),
                            "tamanho":  tam,
                        })

        if not schema_dict:
            raise Exception("Nenhuma tabela retornada pelo Protheus.")

        # Persiste em tenant_schemas (cache legivel) + TenantDictionaryTable (modelo V4)
        db.query(TenantSchema).filter(
            TenantSchema.tenant_id == tenant_id,
            TenantSchema.modulo.in_(clean_modulos),
        ).delete(synchronize_session=False)

        for chave, meta in schema_dict.items():
            db.add(TenantSchema(
                tenant_id  =tenant_id,
                modulo     =meta["modulo"],
                chave      =chave,
                tabela     =meta["tabela"],
                nome       =meta["nome"],
                schema_json=meta,
            ))
            # Upsert no dicionario V4
            existing_dt = db.query(TenantDictionaryTable).filter(
                TenantDictionaryTable.tenant_id  == tenant_id,
                TenantDictionaryTable.snapshot_id == snapshot.id,
                TenantDictionaryTable.table_key   == chave,
            ).first()
            if not existing_dt:
                db.add(TenantDictionaryTable(
                    snapshot_id    =snapshot.id,
                    tenant_id      =tenant_id,
                    module_code    =meta["modulo"],
                    table_key      =chave,
                    physical_name  =meta["tabela"][:30] if meta["tabela"] else chave[:30],
                    table_name     =meta["nome"],
                    unique_index_expr=meta.get("indice_principal"),
                    usa_empresa    =meta["compartilhamento"]["empresa"],
                    usa_unidade    =meta["compartilhamento"]["unidade"],
                    usa_filial     =meta["compartilhamento"]["filial"],
                ))

        snapshot.sync_status  = "completed"
        snapshot.total_tables = len(schema_dict)
        db.commit()

        return {
            "success":     True,
            "message":     f"{len(schema_dict)} tabelas sincronizadas (V4).",
            "snapshot_id": str(snapshot.id),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schemas")
def get_schemas(
    tenant_id: str,
    db: Session   = Depends(get_db),
    admin: str    = Depends(verify_admin),
):
    schemas = (
        db.query(TenantSchema)
        .filter(TenantSchema.tenant_id == tenant_id)
        .all()
    )
    return {
        "schemas": [
            {
                "id":           s.id,
                "modulo":       s.modulo,
                "chave":        s.chave,
                "tabela":       s.tabela,
                "nome":         s.nome,
                "campos_count": len(s.schema_json.get("campos", [])),
                "compartilhamento": s.schema_json.get("compartilhamento", {}),
            }
            for s in schemas
        ]
    }


# ─────────────────────────────────────────────────────────────
# USERS  (V4: User + Role + user_roles)
# Substitui /agent-users e /agent-roles
# ─────────────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    tenant_id: str
    email:     str
    full_name: str  = "Usuário do Sistema"
    password:  str
    role_code: str  = "tenant_admin"


class AdminUserUpdate(BaseModel):
    full_name:  Optional[str] = None
    password:   Optional[str] = None
    role_code:  Optional[str] = None
    status:     Optional[str] = None


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.get("/users")
def list_users(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    q = db.query(User)
    if tenant_id:
        q = q.filter(User.tenant_id == tenant_id)
    users = q.order_by(User.created_at.desc()).all()
    return [
        {
            "id":        str(u.id),
            "tenant_id": str(u.tenant_id) if u.tenant_id else None,
            "email":     u.email,
            "full_name": u.full_name,
            "status":    u.status,
            "created_at":u.created_at,
        }
        for u in users
    ]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    req: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=409, detail="E-mail ja cadastrado.")

    new_user = User(
        tenant_id    =req.tenant_id,
        email        =req.email,
        full_name    =req.full_name,
        password_hash=_hash(req.password),
    )
    db.add(new_user)
    db.flush()

    role = db.query(Role).filter(Role.role_code == req.role_code).first()
    if role:
        db.execute(
            user_roles.insert().values(
                user_id   =new_user.id,
                role_id   =role.id,
                tenant_id =req.tenant_id,
                company_id=None,
            )
        )
    db.commit()
    return {"success": True, "id": str(new_user.id)}


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    req: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID invalido.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    if req.full_name:  user.full_name     = req.full_name
    if req.password:   user.password_hash = _hash(req.password)
    if req.status:     user.status        = req.status
    if req.role_code:
        role = db.query(Role).filter(Role.role_code == req.role_code).first()
        if role and user.tenant_id:
            db.execute(
                user_roles.delete().where(
                    (user_roles.c.user_id   == user.id) &
                    (user_roles.c.tenant_id == user.tenant_id)
                )
            )
            db.execute(
                user_roles.insert().values(
                    user_id   =user.id,
                    role_id   =role.id,
                    tenant_id =user.tenant_id,
                    company_id=None,
                )
            )
    db.commit()
    return {"success": True}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID invalido.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    db.delete(user)
    db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────
# ROLES  (V4: Role)
# Substitui /agent-roles
# ─────────────────────────────────────────────────────────────

class RoleCreateUpdate(BaseModel):
    role_code:   str
    role_name:   str
    scope_level: str = "tenant"   # platform | tenant | company


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    roles = db.query(Role).order_by(Role.role_code).all()
    return [
        {"id": str(r.id), "role_code": r.role_code, "role_name": r.role_name, "scope_level": r.scope_level}
        for r in roles
    ]


@router.post("/roles", status_code=status.HTTP_201_CREATED)
def create_role(
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    if db.query(Role).filter(Role.role_code == req.role_code).first():
        raise HTTPException(status_code=409, detail=f"role_code '{req.role_code}' ja existe.")
    db.add(Role(role_code=req.role_code, role_name=req.role_name, scope_level=req.scope_level))
    db.commit()
    return {"success": True}


@router.put("/roles/{role_id}")
def update_role(
    role_id: str,
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    try:
        rid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID invalido.")
    role = db.query(Role).filter(Role.id == rid).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role nao encontrada.")
    role.role_code   = req.role_code
    role.role_name   = req.role_name
    role.scope_level = req.scope_level
    db.commit()
    return {"success": True}


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    try:
        rid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID invalido.")
    role = db.query(Role).filter(Role.id == rid).first()
    if role:
        db.delete(role)
        db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────
# DASHBOARD STATS
# ─────────────────────────────────────────────────────────────

@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    from datetime import datetime, timedelta, timezone

    total_logs       = db.query(AuditLog).count()
    active_companies = db.query(Company).count()
    total_users      = db.query(User).count()
    total_memories   = db.query(Memory).count()
    total_queries    = db.query(AgentQueryAudit).count()

    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    logs_24h  = db.query(AuditLog).filter(AuditLog.created_at >= yesterday).count()
    queries_24h = db.query(AgentQueryAudit).filter(AgentQueryAudit.created_at >= yesterday).count()

    return {
        "total_consultas":      total_logs,
        "total_queries_agente": total_queries,
        "empresas_ativas":      active_companies,
        "usuarios_cadastrados": total_users,
        "total_memorias":       total_memories,
        "consultas_24h":        logs_24h,
        "queries_agente_24h":   queries_24h,
        "status_sistema":       "Online",
    }


# ─────────────────────────────────────────────────────────────
# LOGS E AUDITORIA
# ─────────────────────────────────────────────────────────────

@router.get("/logs")
def get_logs(
    limit: int  = 50,
    skip:  int  = 0,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return {"logs": logs}


@router.get("/query-audit")
def get_query_audit(
    tenant_id: Optional[str] = None,
    limit: int  = 50,
    skip:  int  = 0,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    """Log detalhado de queries geradas pelo agente (substitui api_usage_logs)."""
    q = db.query(AgentQueryAudit)
    if tenant_id:
        q = q.filter(AgentQueryAudit.tenant_id == tenant_id)
    rows = q.order_by(AgentQueryAudit.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "query_audit": [
            {
                "id":              str(r.id),
                "tenant_id":       r.tenant_id,
                "prompt":          r.natural_language_prompt,
                "sql":             r.generated_sql,
                "status":          r.execution_status,
                "rows_returned":   r.rows_returned,
                "response_ms":     r.response_time_ms,
                "blocked_reason":  r.blocked_reason,
                "tables_used":     r.tables_used,
                "created_at":      r.created_at,
            }
            for r in rows
        ]
    }
