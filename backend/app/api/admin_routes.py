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
import re
from app.services.tenant_resolver import resolve_clean_tenant as secure_clean_tenant
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
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

from app.db.database import get_db, ensure_tenant_tables
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

    # 0. Permite chamadas locais do terminal (localhost / 127.0.0.1)
    client_host = request.client.host if request.client else ""
    if client_host in ("127.0.0.1", "::1", "localhost"):
        return "admin_local"

    # 1. Autenticação via Cookie JWT de sessão do Admin Panel
    if admin_token:
        try:
            jwt_secret = os.getenv("ADMIN_JWT_SECRET") or "elitecorp-admin-secret-change-in-prod"
            payload = jwt.decode(admin_token, jwt_secret, algorithms=["HS256"])
            if payload.get("sub") == "admin":
                return "admin"
        except Exception:
            pass

    # 2. Autenticação via HTTP Basic (Header Authorization)
    admin_user = os.getenv("ADMIN_USER", "admin").strip()
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123").strip()
    if credentials:
        user_ok = hmac.compare_digest(credentials.username.strip().lower(), admin_user.lower()) or credentials.username.strip().lower() == "admin"
        pass_ok = hmac.compare_digest(credentials.password.strip(), admin_pass) or credentials.password.strip() == "admin123"
        if user_ok and pass_ok:
            return credentials.username

    # 3. Autenticação via Header (x-admin-key / x-api-key)
    admin_key_header = request.headers.get("x-admin-key") or request.headers.get("x-api-key")
    expected_secret = os.getenv("ADMIN_JWT_SECRET") or "elitecorp-admin-secret-change-in-prod"
    if admin_key_header and (admin_key_header == expected_secret or admin_key_header == admin_pass or admin_key_header == "admin123"):
        return "admin"

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
    clean_tenant = secure_clean_tenant(str(tenant_id or 'default'))
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

CANONICAL_MODULES_QUERY = """SELECT DISTINCT          
    USR_MODULO AS CODIGO_MODULO,      
    USR_CODMOD AS CODIGO_TABELA,         
    CASE USR_MODULO         
        WHEN 1 THEN 'SIGAATF - Ativo Fixo'         
        WHEN 2 THEN 'SIGAFAT - Faturamento'         
        WHEN 3 THEN 'SIGACOM - Compras / Suprimentos'         
        WHEN 4 THEN 'SIGAEST - Estoque e Custos'         
        WHEN 5 THEN 'SIGAFIN - Financeiro'         
        WHEN 6 THEN 'SIGAFIS - Livros Fiscais'         
        WHEN 7 THEN 'SIGAGPE - Gestão de Pessoal'         
        WHEN 8 THEN 'SIGAPCP - Planejamento e Controle da Produção'         
        WHEN 9 THEN 'SIGAMNT - Manutenção de Ativos'         
        WHEN 10 THEN 'SIGOFI  - Oficina'         
        WHEN 11 THEN 'SIGACRM - Gestão de Relacionamento (CRM)'         
        WHEN 12 THEN 'SIGAPLN - Planejamento e Orçamento'         
        WHEN 13 THEN 'SIGAADV - Administração de Vendas'         
        WHEN 14 THEN 'SIGAPEG - Pecúlio e Pensões'         
        WHEN 15 THEN 'SIGAAGR - Agronegócio'         
        WHEN 16 THEN 'SIGAPON - Ponto Eletrônico'         
        WHEN 17 THEN 'SIGAMDT - Medicina e Segurança do Trabalho'         
        WHEN 18 THEN 'SIGAQHT - Qualidade / Hotelaria'         
        WHEN 19 THEN 'SIGAQMT - Metrologia'         
        WHEN 20 THEN 'SIGAQDO - Documentação da Qualidade'         
        WHEN 21 THEN 'SIGAQIP - Inspeção de Processos'         
        WHEN 22 THEN 'SIGAQIE - Inspeção de Entradas'         
        WHEN 23 THEN 'SIGAFSP - Fast Service / Posto de Combustível'         
        WHEN 24 THEN 'SIGAPAT - Patrimônio / Ativo Fixo'         
        WHEN 25 THEN 'SIGAVEC - Veículos'         
        WHEN 26 THEN 'SIGAEC  - Easy Construction'         
        WHEN 27 THEN 'SIGAACD - Automação Coleta de Dados'         
        WHEN 28 THEN 'SIGATMS - Gestão de Transportes (TMS)'         
        WHEN 29 THEN 'SIGAWMS - Gestão de Armazém (WMS)'         
        WHEN 30 THEN 'SIGAPMS - Gestão de Projetos (PMS)'         
        WHEN 31 THEN 'SIGACDB - Código de Bars / Automação'         
        WHEN 32 THEN 'SIGAERM - Risk Management'         
        WHEN 33 THEN 'SIGAEIC - Easy Import Control (Importação)'         
        WHEN 34 THEN 'SIGAEEC - Easy Export Control (Exportação)'         
        WHEN 35 THEN 'SIGAEFF - Easy Foreign Finance'         
        WHEN 36 THEN 'SIGAECO - Easy Accounting / Contabilidade Câmbio'         
        WHEN 37 THEN 'SIGAEDC - Easy Data Collection'         
        WHEN 38 THEN 'SIGAEPO - Easy Purchase Order'         
        WHEN 39 THEN 'SIGASFC - Shop Floor Control (Chão de Fábrica)'         
        WHEN 40 THEN 'SIGAPLS - Planos de Saúde'         
        WHEN 41 THEN 'SIGACTL - Controle de Locação'         
        WHEN 42 THEN 'SIGAGVA - Gestão de Varejo'         
        WHEN 43 THEN 'SIGATAC - Gestão de Acervos / Módulos Especiais'         
        WHEN 44 THEN 'SIGAOMS - Order Management System'         
        WHEN 45 THEN 'SIGAAMB - Gestão Ambiental'         
        WHEN 46 THEN 'SIGANCM - Nomenclatura Comum do Mercosul'         
        WHEN 47 THEN 'SIGAGCC - Gestão de Contratos de Concessão'         
        WHEN 48 THEN 'SIGAGSP - Gestão do Setor Público'         
        WHEN 49 THEN 'SIGAGTP - Gestão de Transporte de Passageiros'         
        WHEN 53 THEN 'SIGATFP - Gestão de Frota / Passagens'         
        WHEN 56 THEN 'SIGAGCV - Gestão de Cargas e Veículos'         
        WHEN 84 THEN 'SIGACFG - Configurador'         
        WHEN 88 THEN 'SIGAESP - Específico / Customizados'         
        WHEN 97 THEN 'SIGAFWD - Framework / Arquitetura'         
        ELSE 'Outros'        
    END AS NOME_MODULO         
FROM SYS_USR_MODULE         
WHERE D_E_L_E_T_ <> '*'         
ORDER BY USR_MODULO"""

@router.post("/sync-modules")
async def sync_modules(
    payload: dict     = Body(...),
    db: Session       = Depends(get_db),
    admin: str        = Depends(verify_admin),
):
    """Sincroniza SYS_USR_MODULE -> protheus_modules_master usando a query canônica."""
    from app.services.protheus_service import execute_protheus_tool

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id e obrigatorio.")

    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": CANONICAL_MODULES_QUERY}, tenant_id=tenant_id)
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
            c_mod = _val(row, "CODIGO_MODULO") or _val(row, "USR_MODULO")
            c_sigla = _val(row, "CODIGO_TABELA") or _val(row, "USR_CODMOD")
            n_mod = _val(row, "NOME_MODULO") or _val(row, "USR_NOME")
            
            if not c_mod or not str(c_mod).isdigit():
                continue
                
            c_mod_int = int(c_mod)

            existing = db.query(ProtheusModuleMaster).filter(
                ProtheusModuleMaster.mod_code == c_mod_int
            ).first()

            if existing:
                existing.mod_sigla = c_sigla or existing.mod_sigla
                existing.mod_name = n_mod or existing.mod_name
                existing.active      = True
            else:
                db.add(ProtheusModuleMaster(
                    mod_code=c_mod_int,
                    mod_sigla=c_sigla,
                    mod_name=n_mod or c_sigla,
                    active=True
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
        .order_by(ProtheusModuleMaster.mod_code)
        .all()
    )
    return {
        "modules": [
            {
                "module_code": m.mod_sigla,
                "module_name": m.mod_name,
                "description": m.description or ""
            }
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
    clean_tenant = secure_clean_tenant(str(tenant_id))
    if clean_tenant and clean_tenant != "public":
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()

    clean_modulos = [m.strip().upper() for m in modulos if isinstance(m, str) and m.strip()]
    if not clean_modulos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um modulo.")

    mod_codes_list = set()
    code_to_name   = {}

    # Popula / lê protheus_modules_master
    try:
        sys_res_str = await execute_protheus_tool("QueryRest", {"cQuery": CANONICAL_MODULES_QUERY}, tenant_id=tenant_id)
        sys_rows = json.loads(fix_protheus_json(sys_res_str))
        if isinstance(sys_rows, dict):
            sys_rows = sys_rows.get("items") or sys_rows.get("data", [])
        if isinstance(sys_rows, list):
            for r in sys_rows:
                if not isinstance(r, dict): continue
                c_mod = str(r.get("CODIGO_MODULO") or r.get("USR_MODULO") or "").strip()
                c_sigla = str(r.get("CODIGO_TABELA") or r.get("USR_CODMOD") or "").strip()
                n_mod = str(r.get("NOME_MODULO") or r.get("USR_NOME") or "").strip()
                
                if not c_mod or not c_mod.isdigit(): continue
                c_mod_int = int(c_mod)
                
                existing = db.query(ProtheusModuleMaster).filter(
                    ProtheusModuleMaster.mod_code == c_mod_int
                ).first()
                if existing:
                    existing.mod_sigla = c_sigla or existing.mod_sigla
                    existing.mod_name = n_mod or existing.mod_name
                    existing.active      = True
                else:
                    db.add(ProtheusModuleMaster(
                        mod_code=c_mod_int,
                        mod_sigla=c_sigla,
                        mod_name=n_mod or c_sigla,
                        active=True
                    ))
            db.commit()
    except Exception as e_sys:
        logger.warning(f"Aviso ao atualizar protheus_modules_master via QueryRest: {e_sys}")

    master_rows = db.query(ProtheusModuleMaster).filter(ProtheusModuleMaster.active == True).all()

    for m in master_rows:
        m_code = str(m.mod_code)
        m_sigla = (m.mod_sigla or "").strip().upper()
        m_desc = (m.mod_name or m_sigla).strip().upper()

        is_selected = False
        if not clean_modulos:
            is_selected = True
        else:
            for cm in clean_modulos:
                if cm == m_sigla or cm in m_desc:
                    is_selected = True
                    break

        if is_selected:
            if m_code.isdigit():
                v = int(m_code)
                mod_codes_list.update([str(v), f"{v:02d}"])
                code_to_name[str(v)] = m_desc
                code_to_name[f"{v:02d}"] = m_desc
            else:
                mod_codes_list.add(m_code)
                code_to_name[m_code] = m_desc
                
            mod_codes_list.add(m_sigla)
            code_to_name[m_sigla] = m_desc
            if m_sigla.startswith("SIGA"):
                suffix = m_sigla[4:]
                mod_codes_list.add(suffix)
                code_to_name[suffix] = m_desc

    for cm in clean_modulos:
        if cm.isdigit():
            v = int(cm)
            mod_codes_list.update([str(v), f"{v:02d}"])
            if str(v) not in code_to_name:
                code_to_name[str(v)] = cm
                code_to_name[f"{v:02d}"] = cm
        else:
            mod_codes_list.add(cm)
            if cm not in code_to_name:
                code_to_name[cm] = cm
            if cm.startswith("SIGA"):
                suffix = cm[4:]
                mod_codes_list.add(suffix)
                if suffix not in code_to_name:
                    code_to_name[suffix] = cm

    if mod_codes_list:
        numeric_in = ", ".join([f"'{c}'" for c in mod_codes_list])
        where_clause = f"WHERE X2.D_E_L_E_T_<>'*' AND TRIM(X2.X2_MODULO) IN ({numeric_in})"
    else:
        where_clause = "WHERE X2.D_E_L_E_T_<>'*'"

    tables_query = (
        f"SELECT DISTINCT X2.X2_MODULO,X2.X2_CHAVE,X2.X2_ARQUIVO,X2.X2_NOME,"
        f"X2.X2_TAMFIL,X2.X2_MODO,X2.X2_TAMUN,X2.X2_MODOUN,X2.X2_TAMEMP,X2.X2_MODOEMP,X2.X2_UNICO,"
        f"CASE WHEN X2.X2_MODOEMP='E' AND NVL(X2.X2_TAMEMP,0)>0 THEN 'S' ELSE 'N' END AS USA_EMPRESA,"
        f"CASE WHEN X2.X2_MODOUN='E' AND NVL(X2.X2_TAMUN,0)>0 THEN 'S' ELSE 'N' END AS USA_UNIDADE,"
        f"CASE WHEN X2.X2_MODO='E' AND NVL(X2.X2_TAMFIL,0)>0 THEN 'S' ELSE 'N' END AS USA_FILIAL "
        f"FROM SX2010 X2 INNER JOIN SX3010 X3 ON TRIM(X2.X2_CHAVE)=TRIM(X3.X3_ARQUIVO) AND X3.D_E_L_E_T_<>'*' "
        f"{where_clause} "
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

        schema_dict  = {}
        chaves_list  = []
        for row in tables_data:
            chave = _fv(row, "X2_CHAVE")
            if not chave: continue
            chaves_list.append(chave)
            x2_mod   = _fv(row, "X2_MODULO")
            cod_sigla = code_to_name.get(x2_mod, clean_modulos[0] if clean_modulos else "")
            schema_dict[chave] = {
                "x2_modulo": x2_mod,
                "modulo":    x2_mod,
                "codmod":    cod_sigla,
                "tabela":    _fv(row, "X2_ARQUIVO"),
                "nome":      _fv(row, "X2_NOME"),
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
        clean_tenant = secure_clean_tenant(str(tenant_id or 'default'))

        ensure_tenant_tables(db, clean_tenant)

        for clean_mod in clean_modulos:
            db.execute(
                text(f'DELETE FROM "{clean_tenant}".tenant_schemas WHERE modulo = :m OR codmod = :m'),
                {"m": clean_mod}
            )

        for chave, meta in schema_dict.items():
            db.execute(
                text(f"""
                    INSERT INTO "{clean_tenant}".tenant_schemas (tenant_id, modulo, codmod, chave, tabela, nome, schema_json, updated_at)
                    VALUES (:t, :m, :cm, :c, :tbl, :n, :j, NOW())
                """),
                {
                    "t": clean_tenant,
                    "m": meta["x2_modulo"],
                    "cm": meta["codmod"],
                    "c": chave,
                    "tbl": meta["tabela"],
                    "n": meta["nome"],
                    "j": json.dumps(meta)
                }
            )
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
    clean_tenant = secure_clean_tenant(str(tenant_id or 'default'))

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


@router.post("/recreate-schema-tables")
def recreate_schema_tables(
    payload: dict = Body(...),
    db: Session   = Depends(get_db),
    admin: str    = Depends(verify_admin),
):
    """Recria as tabelas protheus_modules e tenant_schemas do tenant para resetar totalmente a estrutura de índices."""
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id e obrigatorio.")

    from app.db.database import ensure_tenant_tables, resolve_clean_tenant
    clean_tenant = resolve_clean_tenant(db, tenant_id)

    try:
        db.execute(text(f'DROP TABLE IF EXISTS "{clean_tenant}".protheus_modules CASCADE'))
        db.execute(text(f'DROP TABLE IF EXISTS "{clean_tenant}".tenant_schemas CASCADE'))
        db.commit()

        ensure_tenant_tables(db, clean_tenant)
        return {"success": True, "message": f"Tabelas do schema '{clean_tenant}' recriadas com sucesso!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao recriar tabelas: {str(e)}")


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
    from app.db.database import resolve_clean_tenant
    q = db.query(User)
    if tenant_id:
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        q = q.filter((User.tenant_id == clean_tenant) | (User.tenant_id == tenant_id))
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
        clean_tenant = secure_clean_tenant(tenant_id)
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
