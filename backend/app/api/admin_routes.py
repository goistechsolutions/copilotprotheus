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
security = HTTPBasic(auto_error=False)

ENV_PATH = Path(".env")

# ─────────────────────────────────────────────────────────────
# Autenticacao administrativa (Cookie JWT ou HTTP Basic)
# ─────────────────────────────────────────────────────────────

from fastapi import Cookie, Request
import jwt

def verify_admin(
    request: Request,
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(None)
):
    import hmac
    # 1. Autenticação via Cookie JWT de sessão do Admin Panel
    if admin_token:
        try:
            jwt_secret = os.getenv("ADMIN_JWT_SECRET") or os.getenv("JWT_SECRET", "elitecorp-admin-secret-change-in-prod")
            payload = jwt.decode(admin_token, jwt_secret, algorithms=["HS256"])
            if payload.get("sub") == "admin":
                return "admin"
        except Exception:
            pass

    # 2. Autenticação via HTTP Basic (Header Authorization)
    admin_user = os.getenv("ADMIN_USER", "admin").strip()
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123").strip()
    if credentials:
        user_ok = hmac.compare_digest(credentials.username.strip().lower(), admin_user.lower())
        pass_ok = hmac.compare_digest(credentials.password.strip(), admin_pass)
        if user_ok and pass_ok:
            return credentials.username

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais de administrador inválidas ou sessão expirada"
    )


# ─────────────────────────────────────────────────────────────
# UTILITÁRIO: sanitização robusta de JSON do Protheus Cloud
# ─────────────────────────────────────────────────────────────

def fix_protheus_json(raw: str) -> str:
    """
    Sanitiza o JSON retornado pelo Protheus Cloud que pode conter:
      1. Caracteres de controle raw (\\x00-\\x1f) em strings — ex: \\t, \\r, \\n literais
      2. Backslash inválido antes de caracteres não-especiais JSON —
         ex: \\-  \\(  \\_  \\C  \\P  \\u sem 4 hex-digits
         Isso causa "Invalid \\escape" no json.loads padrão.

    Estratégia:
      - Percorre o texto char a char dentro de strings JSON.
      - Substitui sequências \\X inválidas por X (remove a barra).
      - Substitui caracteres de controle raw por sua representação \\uXXXX.
    """
    if not raw:
        return ""

    # Escapes válidos em JSON: " \ / b f n r t u
    VALID_ESCAPES = set('"\\/bfnrtu')

    out = []
    i = 0
    n = len(raw)
    in_string = False

    while i < n:
        ch = raw[i]

        if in_string:
            if ch == '\\':
                # Verifica o próximo caractere
                if i + 1 < n:
                    nxt = raw[i + 1]
                    if nxt in VALID_ESCAPES:
                        # Escape válido: copia os dois chars
                        out.append(ch)
                        out.append(nxt)
                        # Para \uXXXX, copia também os 4 hex-digits se existirem
                        if nxt == 'u':
                            hex_seq = raw[i + 2:i + 6]
                            if len(hex_seq) == 4 and all(c in '0123456789abcdefABCDEF' for c in hex_seq):
                                out.append(hex_seq)
                                i += 6
                            else:
                                # \u sem 4 hex válidos — substitui por espaço
                                out.pop()  # remove 'u'
                                out.pop()  # remove '\\'
                                out.append(' ')
                                i += 2
                        else:
                            i += 2
                    else:
                        # Backslash inválido: descarta a barra, mantém o char seguinte
                        out.append(nxt)
                        i += 2
                else:
                    # \\ no final do buffer — descarta
                    i += 1
            elif ch == '"':
                in_string = False
                out.append(ch)
                i += 1
            elif ord(ch) < 0x20:
                # Caractere de controle raw dentro de string — converte para \\uXXXX
                if ch == '\n':
                    out.append('\\n')
                elif ch == '\r':
                    out.append('\\r')
                elif ch == '\t':
                    out.append('\\t')
                else:
                    out.append(f'\\u{ord(ch):04x}')
                i += 1
            else:
                out.append(ch)
                i += 1
        else:
            if ch == '"':
                in_string = True
            out.append(ch)
            i += 1

    return ''.join(out)


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
    import re
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()

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

    modules_query = "SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE ORDER BY USR_MODULO"
    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": modules_query}, tenant_id=tenant_id)
        result_data  = json.loads(fix_protheus_json(response_str))
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
            mod_code = _val(row, "USR_MODULO")
            mod_name = _val(row, "USR_CODMOD")
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

    tenant_id = payload.get("tenant_id")
    modulos   = payload.get("modulos", [])
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id e obrigatorio.")

    import re
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()

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
    fallback_details = {
        "SIGAATF": ("01", "Ativo Fixo"),
        "SIGACOM": ("02", "Compras"),
        "SIGAEST": ("04", "Estoque e Custos"),
        "SIGAFAT": ("05", "Faturamento"),
        "SIGAFIN": ("06", "Financeiro"),
        "SIGAGPE": ("07", "Gestão de Pessoal"),
        "SIGAFIS": ("09", "Livros Fiscais"),
        "SIGAPON": ("16", "Ponto Eletrônico"),
        "SIGATMK": ("31", "Telemarketing"),
        "SIGACTB": ("34", "Contabilidade Gerencial"),
        "SIGAADV": ("34", "Desenvolvimento AdvPL"),
        "SIGAMNT": ("43", "Manutenção de Ativos"),
        "SIGAJURI": ("76", "Jurídico"),
    }

    existing_all = db.query(ProtheusModuleMaster).all()
    existing_map = {m.module_code: m for m in existing_all}
    changed = False

    for code, (num, name) in fallback_details.items():
        if code not in existing_map:
            db.add(ProtheusModuleMaster(
                module_code=code,
                module_name=name,
                source_name="fallback_hardcoded",
                active=True
            ))
            changed = True
        else:
            # Se o module_name gravado era apenas número ('01', '05', etc.), atualiza para o nome amigável
            m = existing_map[code]
            if m.module_name.isdigit() or len(m.module_name.strip()) <= 2:
                m.module_name = name
                changed = True

    if changed:
        db.commit()

    db_mods = (
        db.query(ProtheusModuleMaster)
        .filter(ProtheusModuleMaster.module_code.in_(clean_modulos))
        .all()
    )

    mod_codes_list = set()
    code_to_name   = {}

    # 1. Consulta dinâmica no Protheus (SYS_USR_MODULE)
    try:
        sys_query = "SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE ORDER BY USR_MODULO"
        sys_res_str = await execute_protheus_tool("QueryRest", {"cQuery": sys_query}, tenant_id=tenant_id)
        sys_rows = json.loads(fix_protheus_json(sys_res_str))
        if isinstance(sys_rows, dict):
            sys_rows = sys_rows.get("items") or sys_rows.get("data", [])

        if isinstance(sys_rows, list):
            for row in sys_rows:
                if not isinstance(row, dict): continue
                u_mod = (row.get("USR_CODMOD") or "").strip().upper()
                u_cod = (row.get("USR_MODULO") or "").strip()
                if u_mod in clean_modulos and u_cod:
                    if u_cod.isdigit():
                        v = int(u_cod)
                        mod_codes_list.update([str(v), f"{v:02d}"])
                        code_to_name[str(v)] = u_mod
                        code_to_name[f"{v:02d}"] = u_mod
                    else:
                        mod_codes_list.add(u_cod)
                        code_to_name[u_cod] = u_mod
    except Exception as e_sys:
        logger.warning(f"Aviso ao consultar SYS_USR_MODULE via QueryRest para {tenant_id}: {e_sys}")

    # 2. Fallback caso a consulta dinamica nao traga o modulo selecionado
    fallback_num_map = {
        "SIGAATF": "01", "SIGACOM": "02", "SIGAEST": "04", "SIGAFAT": "05",
        "SIGAFIN": "06", "SIGAGPE": "07", "SIGAFIS": "09", "SIGAPON": "16",
        "SIGATMK": "31", "SIGACTB": "34", "SIGAADV": "34", "SIGAMNT": "43", "SIGAJURI": "76",
    }

    for m in db_mods:
        code_key = m.module_code.strip().upper()
        if code_key in clean_modulos:
            num = fallback_num_map.get(code_key) or (m.module_name.strip() if m.module_name and m.module_name.isdigit() else "05")
            if num.isdigit():
                v = int(num)
                mod_codes_list.update([str(v), f"{v:02d}"])
                code_to_name[str(v)] = m.module_code
                code_to_name[f"{v:02d}"] = m.module_code
            else:
                mod_codes_list.add(num)
                code_to_name[num] = m.module_code

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
        try:
            response_str = await execute_protheus_tool("QueryRest", {"cQuery": tables_query}, tenant_id=tenant_id)
        except Exception as exc:
            err_msg = str(exc)
            if "401" in err_msg or "Unauthorized" in err_msg or "authentication" in err_msg.lower():
                detail = f"Falha de autenticação (HTTP 401) no servidor REST Protheus ({tenant_id}). Verifique se o Usuário e a Senha REST no cadastro do Tenant/Empresa estão corretos no Protheus."
            elif "Name or service not known" in err_msg or "gaierror" in err_msg:
                detail = f"Falha de DNS ao conectar no Protheus REST: Domínio não encontrado. Verifique a URL REST no cadastro da empresa/tenant. Erro: {err_msg}"
            elif "Timeout" in err_msg or "timed out" in err_msg:
                detail = f"Timeout de conexão com a API REST Protheus. Verifique se a porta e o serviço REST estão online. Erro: {err_msg}"
            else:
                detail = f"Falha ao comunicar com o servidor Protheus REST ({tenant_id}): {err_msg}"
            raise HTTPException(status_code=400, detail=detail)

        tables_data = json.loads(fix_protheus_json(response_str))
        if isinstance(tables_data, dict):
            tables_data = tables_data.get("items") or tables_data.get("data", [])
        if isinstance(tables_data, dict) and "error" in tables_data:
            raise HTTPException(status_code=400, detail=f"Erro retornado pela API Protheus: {tables_data['error']}")
        if not isinstance(tables_data, list) or not tables_data:
            raise HTTPException(status_code=400, detail=f"Nenhuma tabela encontrada para os módulos: {', '.join(clean_modulos)}")

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
            fd       = json.loads(fix_protheus_json(fr_str))
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

        # Persiste em "{clean_tenant}".tenant_schemas (cache legivel no schema do tenant)
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or ''))
        if not clean_tenant or clean_tenant == "public":
            clean_tenant = "default"

        ensure_tenant_tables(db, clean_tenant)

        try:
            for clean_mod in clean_modulos:
                db.execute(
                    text(f'DELETE FROM "{clean_tenant}".tenant_schemas WHERE modulo = :m'),
                    {"m": clean_mod}
                )

            for chave, meta in schema_dict.items():
                db.execute(
                    text(f"""
                        INSERT INTO "{clean_tenant}".tenant_schemas (tenant_id, modulo, chave, tabela, nome, schema_json, updated_at)
                        VALUES (:t, :m, :c, :tbl, :n, :j, NOW())
                    """),
                    {
                        "t": clean_tenant,
                        "m": meta["modulo"],
                        "c": chave,
                        "tbl": meta["tabela"],
                        "n": meta["nome"],
                        "j": json.dumps(meta)
                    }
                )
        except Exception as e_ts:
            logger.warning(f"Aviso ao persistir tenant_schemas em {clean_tenant}: {e_ts}")
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
   import re
    from app.db.database import ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))

    if not clean_tenant or clean_tenant == "public":
        clean_tenant = "default"

    ensure_tenant_tables(db, clean_tenant)

    try:
        rows = db.execute(
            text(f'SELECT id, modulo, chave, tabela, nome, schema_json FROM "{clean_tenant}".tenant_schemas ORDER BY chave')
        ).mappings().all()

        schemas_list = []
        for s in rows:
            schema_json = s.get("schema_json") or {}
            if isinstance(schema_json, str):
                try: schema_json = json.loads(schema_json)
                except Exception: schema_json = {}

            schemas_list.append({
                "id": s["id"],
                "modulo": s["modulo"],
                "chave": s["chave"],
                "tabela": s["tabela"],
                "nome": s["nome"],
                "campos_count": len(schema_json.get("campos", [])) if isinstance(schema_json, dict) else 0,
                "compartilhamento": schema_json.get("compartilhamento", {}) if isinstance(schema_json, dict) else {}
            })

        return {"schemas": schemas_list}
    except Exception as e:
        logger.error(f"Erro ao buscar schemas para {clean_tenant}: {e}")
        return {"schemas": []}


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
    from app.models.knowledge import PlatformAuditLog, TenantRegistry, PlatformAdmin

    total_logs = 0
    try:
        total_logs = db.query(PlatformAuditLog).count()
    except Exception:
        try: db.rollback()
        except: pass

    active_companies = 0
    try:
        active_companies = db.query(TenantRegistry).filter(TenantRegistry.status == 'active').count()
    except Exception:
        try: db.rollback()
        except: pass

    total_users = 0
    try:
        total_users = db.query(PlatformAdmin).count()
    except Exception:
        try: db.rollback()
        except: pass

    total_memories = 0
    total_queries = 0
    queries_24h = 0
    logs_24h = 0

    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    try:
        logs_24h = db.query(PlatformAuditLog).filter(PlatformAuditLog.created_at >= yesterday).count()
    except Exception:
        try: db.rollback()
        except: pass

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
    from app.models.knowledge import PlatformAuditLog
    logs = []
    try:
        logs = (
            db.query(PlatformAuditLog)
            .order_by(PlatformAuditLog.created_at.desc())
            .offset(skip).limit(limit)
            .all()
        )
    except Exception:
        try: db.rollback()
        except: pass
    return {"logs": logs}


@router.get("/query-audit")
def get_query_audit(
    tenant_id: Optional[str] = None,
    limit: int  = 50,
    skip:  int  = 0,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    """Log detalhado de queries geradas pelo agente."""
    rows_data = []
    if tenant_id:
        import re
        from sqlalchemy import text
        clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_id)
        if clean_tenant and clean_tenant != "public":
            try:
                sql = text(f'SELECT id, user_email, question, generated_sql, response_time_ms, created_at FROM "{clean_tenant}".query_audit ORDER BY created_at DESC LIMIT :lim OFFSET :skp')
                res = db.execute(sql, {"lim": limit, "skp": skip}).all()
                for r in res:
                    rows_data.append({
                        "id": str(r[0]),
                        "tenant_id": tenant_id,
                        "prompt": r[2],
                        "sql": r[3],
                        "status": "completed",
                        "response_ms": r[4],
                        "created_at": r[5]
                    })
            except Exception:
                try: db.rollback()
                except: pass

    return {"query_audit": rows_data}
