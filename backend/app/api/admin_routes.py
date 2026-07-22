from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
import os
import json
import dotenv
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import AuditLog, Tenant, Company, AllowedTable
from app.core.config import settings

router = APIRouter()
security = HTTPBasic()

# Arquivo .env e arquivo de configuração de tabelas
ENV_PATH = Path(".env")
TABLES_CONFIG_PATH = Path("tables_config.json")

# Estrutura padrão de tabelas
DEFAULT_TABLES = [
    {
        "alias": "SF2010",
        "description": "FATURAMENTO/VENDAS",
        "fields": "F2_FILIAL, F2_DOC, F2_SERIE, F2_CLIENTE, F2_LOJA, F2_EMISSAO, F2_VALBRUT",
        "tipo": "Cabecalho"
    },
    {
        "alias": "SD2010",
        "description": "FATURAMENTO/VENDAS (Itens)",
        "fields": "D2_FILIAL, D2_DOC, D2_COD, D2_QUANT, D2_TOTAL, D2_EMISSAO",
        "tipo": "Itens"
    },
    {
        "alias": "SF1010",
        "description": "ENTRADAS/COMPRAS",
        "fields": "F1_FILIAL, F1_DOC, F1_SERIE, F1_FORNECE, F1_LOJA, F1_EMISSAO, F1_VALBRUT",
        "tipo": "Cabecalho"
    },
    {
        "alias": "SD1010",
        "description": "ENTRADAS/COMPRAS (Itens)",
        "fields": "D1_FILIAL, D1_DOC, D1_COD, D1_QUANT, D1_TOTAL, D1_EMISSAO",
        "tipo": "Itens"
    },
    {
        "alias": "SA1010",
        "description": "CLIENTES",
        "fields": "A1_COD, A1_NOME, A1_LC, A1_MSBLQL",
        "tipo": "Cadastro"
    },
    {
        "alias": "SA2010",
        "description": "FORNECEDORES",
        "fields": "A2_COD, A2_NOME",
        "tipo": "Cadastro"
    },
    {
        "alias": "SB1010",
        "description": "PRODUTOS",
        "fields": "B1_COD, B1_DESC",
        "tipo": "Cadastro"
    },
    {
        "alias": "SB2010",
        "description": "SALDOS",
        "fields": "B2_COD, B2_QATU",
        "tipo": "Saldo"
    },
    {
        "alias": "SE1010",
        "description": "CONTAS A RECEBER",
        "fields": "E1_NUM, E1_CLIENTE, E1_VENCTO, E1_VALOR, E1_SALDO",
        "tipo": "Financeiro"
    },
    {
        "alias": "SE2010",
        "description": "CONTAS A PAGAR",
        "fields": "E2_NUM, E2_FORNECE, E2_VENCTO, E2_VALOR, E2_SALDO",
        "tipo": "Financeiro"
    }
]


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais de administrador inválidas",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# --- Endpoints de Configuração (.env) ---

class ConfigUpdate(BaseModel):
    key: str
    value: str

@router.get("/config")
def get_config(admin: str = Depends(verify_admin)):
    """Retorna as chaves e valores configurados no .env (ocultando chaves de tenant)"""
    config_dict = dotenv.dotenv_values(ENV_PATH)
    
    # Remove chaves que pertencem às Empresas SaaS (Tenant)
    keys_to_hide = [
        "PROTHEUS_REST_URL", "PROTHEUS_USER", "PROTHEUS_PASSWORD", 
        "PROTHEUS_URL", "PROTHEUS_ENVIRONMENT", "WEBAPP_URL"
    ]
    for k in keys_to_hide:
        config_dict.pop(k, None)
        
    # Chaves padrão que devem estar visíveis no painel (para Integração Cloudflare/R2)
    default_keys = [
        "R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
        "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_API_TOKEN"
    ]
    for key in default_keys:
        if key not in config_dict:
            config_dict[key] = ""
            
    return {"configs": config_dict}

@router.post("/config")
def update_config(update: ConfigUpdate, admin: str = Depends(verify_admin)):
    """Atualiza uma chave no arquivo .env e no objeto settings em memória"""
    # Usar dotenv apenas para ler o estado atual
    config_dict = dotenv.dotenv_values(ENV_PATH)
    config_dict[update.key] = update.value
    
    # Escrever de volta no .env manualmente para evitar erro "Device or resource busy" do Docker
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        for k, v in config_dict.items():
            if v is not None:
                # Tratar quebras de linha ou caracteres especiais
                v_escaped = str(v).replace('\n', '\\n')
                f.write(f"{k}='{v_escaped}'\n")
            else:
                f.write(f"{k}=\n")
                
    os.environ[update.key] = update.value
    
    # Atualizar o objeto settings em memória (se o campo existir no schema do Settings)
    key_lower = update.key.lower()
    if hasattr(settings, key_lower):
        setattr(settings, key_lower, update.value)
        
    return {"success": True, "message": f"Chave {update.key} atualizada."}


# --- Endpoints de Tabelas (Banco de Dados) ---

@router.get("/tables")
def get_tables(tenant_id: str = "default", db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    """Retorna as tabelas permitidas por tenant"""
    tables = db.query(AllowedTable).filter(AllowedTable.tenant_id == tenant_id).all()
    if not tables:
        # Retorna o default se não tiver nada salvo
        return {"tables": DEFAULT_TABLES}
        
    result = []
    for t in tables:
        result.append({
            "id": t.id,
            "alias": t.alias,
            "description": t.description,
            "tipo": t.tipo,
            "fields": t.fields
        })
    return {"tables": result}

@router.post("/tables")
def update_tables(tables: list = Body(...), tenant_id: str = Body(..., embed=True), db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    """Atualiza as tabelas permitidas por tenant"""
    # Deleta as antigas
    db.query(AllowedTable).filter(AllowedTable.tenant_id == tenant_id).delete()
    
    # Insere as novas
    for t in tables:
        new_table = AllowedTable(
            tenant_id=tenant_id,
            alias=t.get("alias", ""),
            description=t.get("description", ""),
            tipo=t.get("tipo", ""),
            fields=t.get("fields", "")
        )
        db.add(new_table)
    
    db.commit()
    return {"success": True, "message": "Tabelas atualizadas com sucesso."}

@router.post("/sync-modules")
async def sync_modules(payload: dict = Body(...), db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    from app.services.protheus_service import execute_protheus_tool
    import json
    from app.models.knowledge import ProtheusModule
    import re
    from sqlalchemy import text
    from app.db.database import Base

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório.")

    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_id) if tenant_id else "default"
    if clean_tenant != "public":
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        import app.models.knowledge
        Base.metadata.create_all(bind=db.connection())
        db.commit()

    modules_query = "/* %notparser% */ SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE WHERE D_E_L_E_T_<>'*' ORDER BY USR_MODULO"

    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": modules_query}, tenant_id=tenant_id)
        result_data = json.loads(response_str)
        if isinstance(result_data, dict) and "items" in result_data:
            result_data = result_data["items"]
        elif isinstance(result_data, dict) and "data" in result_data:
            result_data = result_data["data"]

        if not isinstance(result_data, list):
            raise Exception(f"Retorno inesperado da query: {str(result_data)[:200]}")

        def get_val(row: dict, key: str, default: str = "") -> str:
            if not isinstance(row, dict): return default
            if key in row and row[key] is not None:
                return str(row[key]).strip()
            key_upper = key.strip().upper()
            for k, v in row.items():
                if k.strip().upper() == key_upper:
                    return "" if v is None else str(v).strip()
            return default

        db.query(ProtheusModule).filter(ProtheusModule.tenant_id == tenant_id).delete(synchronize_session=False)

        count = 0
        for row in result_data:
            usr_mod = get_val(row, "USR_MODULO")
            usr_cod = get_val(row, "USR_CODMOD")
            if usr_cod:
                db.add(ProtheusModule(
                    tenant_id=tenant_id,
                    usr_modulo=usr_mod,
                    usr_codmod=usr_cod
                ))
                count += 1

        db.commit()
        print(f"[SYNC-MODULES] Tabela protheus_modules atualizada para o tenant '{clean_tenant}' com {count} módulos.")
        return {"success": True, "message": f"Tabela de referência dos módulos atualizada com sucesso! {count} módulos salvos no schema '{clean_tenant}'."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/protheus-modules")
def get_protheus_modules(tenant_id: str, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    from app.models.knowledge import ProtheusModule
    from app.db.database import Base
    import re
    from sqlalchemy import text

    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_id) if tenant_id else "default"
    if clean_tenant != "public":
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        Base.metadata.create_all(bind=db.connection())
        db.commit()

    modules = db.query(ProtheusModule).filter(ProtheusModule.tenant_id == tenant_id).order_by(ProtheusModule.usr_codmod).all()
    return {
        "modules": [
            {
                "usr_modulo": m.usr_modulo,
                "usr_codmod": m.usr_codmod
            }
            for m in modules
        ]
    }

@router.post("/sync-schema")
async def sync_schema(payload: dict = Body(...), db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    from app.services.protheus_service import execute_protheus_tool
    import json
    from app.models.knowledge import TenantSchema
    tenant_id = payload.get("tenant_id")
    modulos = payload.get("modulos", [])
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório.")

    import re
    from sqlalchemy import text
    from app.db.database import Base
    
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_id) if tenant_id else "default"
    if clean_tenant != "public":
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        import app.models.knowledge
        Base.metadata.create_all(bind=db.connection())
        db.commit()

    clean_modulos = [m.strip().upper() for m in modulos if m and isinstance(m, str) and m.strip()]
    if not clean_modulos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um módulo para sincronizar.")

    from app.models.knowledge import ProtheusModule, TenantSchema
    
    # 1. Verifica/Busca os códigos numéricos X2_MODULO na tabela de referência protheus_modules
    db_mods = db.query(ProtheusModule).filter(
        ProtheusModule.tenant_id == tenant_id,
        ProtheusModule.usr_codmod.in_(clean_modulos)
    ).all()

    # Se a tabela de referência protheus_modules ainda estiver vazia no PostgreSQL, auto-sincroniza a referência primeiro
    if not db_mods:
        print(f"[SYNC-SCHEMA] Tabela protheus_modules vazia para {clean_modulos}. Auto-sincronizando referência SYS_USR_MODULE...")
        modules_query = "/* %notparser% */ SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE WHERE D_E_L_E_T_<>'*' ORDER BY USR_MODULO"
        try:
            resp_str = await execute_protheus_tool("QueryRest", {"cQuery": modules_query}, tenant_id=tenant_id)
            res_data = json.loads(resp_str)
            if isinstance(res_data, dict) and "items" in res_data: res_data = res_data["items"]
            elif isinstance(res_data, dict) and "data" in res_data: res_data = res_data["data"]
            if isinstance(res_data, list):
                def get_v(row: dict, k: str) -> str:
                    if not isinstance(row, dict): return ""
                    if k in row and row[k] is not None: return str(row[k]).strip()
                    for rk, rv in row.items():
                        if rk.strip().upper() == k.upper(): return "" if rv is None else str(rv).strip()
                    return ""
                db.query(ProtheusModule).filter(ProtheusModule.tenant_id == tenant_id).delete(synchronize_session=False)
                for r in res_data:
                    um, uc = get_v(r, "USR_MODULO"), get_v(r, "USR_CODMOD")
                    if uc: db.add(ProtheusModule(tenant_id=tenant_id, usr_modulo=um, usr_codmod=uc))
                db.commit()
                db_mods = db.query(ProtheusModule).filter(
                    ProtheusModule.tenant_id == tenant_id,
                    ProtheusModule.usr_codmod.in_(clean_modulos)
                ).all()
        except Exception as ex_mod:
            print(f"[SYNC-SCHEMA] Aviso ao auto-sincronizar protheus_modules: {ex_mod}")

    # Monta conjunto de códigos numéricos de módulo (ex: '05', '5', '06', '6')
    modulo_codes = set()
    code_to_codmod = {}
    for m in db_mods:
        code = m.usr_modulo.strip()
        if code:
            modulo_codes.add(code)
            code_to_codmod[code] = m.usr_codmod
            if code.isdigit():
                val = int(code)
                code_str = str(val)
                code_padded = f"{val:02d}"
                modulo_codes.add(code_str)
                modulo_codes.add(code_padded)
                code_to_codmod[code_str] = m.usr_codmod
                code_to_codmod[code_padded] = m.usr_codmod

    if not modulo_codes:
        # Fallback se não encontrar o código na SYS_USR_MODULE
        mod_codes_in_str = ", ".join([f"'{m}'" for m in clean_modulos])
        where_clause = f"AND (X2.X2_MODULO IN ({mod_codes_in_str}) OR MOD.USR_CODMOD IN ({mod_codes_in_str}))"
        join_clause = "INNER JOIN (SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE WHERE D_E_L_E_T_<>'*') MOD ON X2.X2_MODULO = MOD.USR_MODULO"
    else:
        mod_codes_in_str = ", ".join([f"'{c}'" for c in modulo_codes])
        where_clause = f"AND X2.X2_MODULO IN ({mod_codes_in_str})"
        join_clause = ""

    # 2. Consulta oficial exata solicitada pelo usuário:
    tables_query = f"""
    /* %notparser% */
    SELECT DISTINCT        
     X2.X2_MODULO,
     X2.X2_CHAVE,         
     X2.X2_ARQUIVO,         
     X2.X2_NOME,         
     X2.X2_TAMFIL,         
     X2.X2_MODO,         
     X2.X2_TAMUN,         
     X2.X2_MODOUN,         
     X2.X2_TAMEMP,         
     X2.X2_MODOEMP,         
     X2.X2_UNICO,         
     CASE WHEN X2.X2_MODOEMP='E' AND NVL(X2.X2_TAMEMP,0)>0 THEN 'S' ELSE 'N' END AS USA_EMPRESA,         
     CASE WHEN X2.X2_MODOUN='E' AND NVL(X2.X2_TAMUN,0)>0 THEN 'S' ELSE 'N' END AS USA_UNIDADE,         
     CASE WHEN X2.X2_MODO='E' AND NVL(X2.X2_TAMFIL,0)>0 THEN 'S' ELSE 'N' END AS USA_FILIAL         
    FROM SX2010 X2         
    INNER JOIN SX3010 X3 ON X2.X2_CHAVE = X3.X3_ARQUIVO AND X3.D_E_L_E_T_ <> '*'
    {join_clause}
    WHERE X2.D_E_L_E_T_ <> '*'
      {where_clause}
    ORDER BY X2.X2_MODULO, X2.X2_CHAVE
    """.replace('\n', ' ').strip()

    try:
        response_str = await execute_protheus_tool("QueryRest", {"cQuery": tables_query}, tenant_id=tenant_id)
        tables_data = json.loads(response_str)
        if isinstance(tables_data, dict) and "items" in tables_data:
            tables_data = tables_data["items"]
        elif isinstance(tables_data, dict) and "data" in tables_data:
            tables_data = tables_data["data"]
            
        if not isinstance(tables_data, list) or len(tables_data) == 0:
            raise Exception(f"Nenhuma tabela encontrada no Protheus para os módulos: {', '.join(clean_modulos)}")

        def get_field_val(row: dict, key: str, default: str = "") -> str:
            if not isinstance(row, dict): return default
            if key in row and row[key] is not None:
                return str(row[key]).strip()
            key_upper = key.strip().upper()
            for k, v in row.items():
                if k.strip().upper() == key_upper:
                    return "" if v is None else str(v).strip()
            return default

        schema_dict = {}
        chaves_list = []
        for row in tables_data:
            chave = get_field_val(row, "X2_CHAVE")
            if not chave: continue
            x2_mod = get_field_val(row, "X2_MODULO")
            codmod_name = code_to_codmod.get(x2_mod, get_field_val(row, "USR_CODMOD", clean_modulos[0] if clean_modulos else ""))
            schema_dict[chave] = {
                "modulo": codmod_name,
                "tabela": get_field_val(row, "X2_ARQUIVO"),
                "nome": get_field_val(row, "X2_NOME"),
                "compartilhamento": {
                    "empresa": get_field_val(row, "USA_EMPRESA", "N"),
                    "unidade": get_field_val(row, "USA_UNIDADE", "N"),
                    "filial": get_field_val(row, "USA_FILIAL", "N")
                },
                "indice_principal": get_field_val(row, "X2_UNICO"),
                "campos": []
            }

        print(f"[SYNC-SCHEMA] Encontradas {len(tables_data)} tabelas para os módulos {clean_modulos} no tenant '{clean_tenant}'.")

        # 2. Busca os campos (SX3010) em lotes leves de 15 tabelas por requisição HTTP
        chunk_size = 15
        total_chunks = (len(chaves_list) + chunk_size - 1) // chunk_size

        for i in range(0, len(chaves_list), chunk_size):
            chunk_chaves = chaves_list[i:i + chunk_size]
            chaves_in_str = ", ".join([f"'{c}'" for c in chunk_chaves])
            chunk_num = (i // chunk_size) + 1
            print(f"[SYNC-SCHEMA] Processando lote {chunk_num}/{total_chunks} ({len(chunk_chaves)} tabelas: {', '.join(chunk_chaves)})...")
            
            fields_query = f"""
            /* %notparser% */
            SELECT 
             X3.X3_ARQUIVO,
             X3.X3_CAMPO,
             X3.X3_DESCRIC,
             X3.X3_TIPO,
             X3.X3_TAMANHO,
             X3.X3_ORDEM
            FROM SX3010 X3
            WHERE X3.D_E_L_E_T_ <> '*'
              AND X3.X3_ARQUIVO IN ({chaves_in_str})
            ORDER BY X3.X3_ARQUIVO, X3.X3_ORDEM, X3.X3_CAMPO
            """.replace('\n', ' ').strip()

            fields_resp_str = await execute_protheus_tool("QueryRest", {"cQuery": fields_query}, tenant_id=tenant_id)
            fields_data = json.loads(fields_resp_str)
            if isinstance(fields_data, dict) and "items" in fields_data:
                fields_data = fields_data["items"]
            elif isinstance(fields_data, dict) and "data" in fields_data:
                fields_data = fields_data["data"]

            if isinstance(fields_data, list):
                for row in fields_data:
                    arq = get_field_val(row, "X3_ARQUIVO")
                    campo_nome = get_field_val(row, "X3_CAMPO")
                    if arq in schema_dict and campo_nome:
                        tam_str = get_field_val(row, "X3_TAMANHO", "0")
                        try:
                            tam_val = int(float(tam_str))
                        except Exception:
                            tam_val = 0
                            
                        schema_dict[arq]["campos"].append({
                            "campo": campo_nome,
                            "descricao": get_field_val(row, "X3_DESCRIC"),
                            "tipo": get_field_val(row, "X3_TIPO"),
                            "tamanho": tam_val
                        })

        if not schema_dict:
            raise Exception("Nenhuma tabela foi retornada pelo Protheus durante a sincronização.")

        # Salvar no banco
        db.query(TenantSchema).filter(
            TenantSchema.tenant_id == tenant_id,
            TenantSchema.modulo.in_(clean_modulos)
        ).delete(synchronize_session=False)
        
        for chave, meta in schema_dict.items():
            db.add(TenantSchema(
                tenant_id=tenant_id,
                modulo=meta["modulo"],
                chave=chave,
                tabela=meta["tabela"],
                nome=meta["nome"],
                schema_json=meta
            ))
        db.commit()
        return {"success": True, "message": f"Schema atualizado com sucesso no schema '{clean_tenant}'! {len(schema_dict)} tabelas sincronizadas."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schemas")
def get_schemas(tenant_id: str, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    from app.models.knowledge import TenantSchema
    from app.db.database import Base
    import re
    from sqlalchemy import text

    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', tenant_id) if tenant_id else "default"
    if clean_tenant != "public":
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        Base.metadata.create_all(bind=db.connection())
        db.commit()

    schemas = db.query(TenantSchema).filter(TenantSchema.tenant_id == tenant_id).all()
    result = []
    for s in schemas:
        result.append({
            "id": s.id,
            "modulo": s.modulo,
            "chave": s.chave,
            "tabela": s.tabela,
            "nome": s.nome,
            "campos_count": len(s.schema_json.get("campos", [])),
            "compartilhamento": s.schema_json.get("compartilhamento", {})
        })
    return {"schemas": result}

# --- Endpoints de Logs e Monitoramento ---

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    from app.models.knowledge import AuditLog, Company, AgentUser, Memory
    from datetime import datetime, timedelta, timezone
    
    # Cálculos
    total_logs = db.query(AuditLog).count()
    active_companies = db.query(Company).count()
    total_users = db.query(AgentUser).count()
    total_memories = db.query(Memory).count()
    
    # Logs das últimas 24h usando datetime em Python para ser compatível com Oracle e Postgres
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    logs_24h = db.query(AuditLog).filter(AuditLog.created_at >= yesterday).count()

    return {
        "total_consultas": total_logs,
        "empresas_ativas": active_companies,
        "usuarios_cadastrados": total_users,
        "total_memorias": total_memories,
        "consultas_24h": logs_24h,
        "status_sistema": "Online"
    }

@router.get("/logs")
def get_logs(limit: int = 50, skip: int = 0, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    """Retorna o histórico de conversas e logs de auditoria"""
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return {"logs": logs}

# --- Endpoints de AgentUsers ---
from app.models.knowledge import AgentUser, AgentRole
from typing import List, Optional
import hashlib

@router.get("/agent-users")
def get_agent_users(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    users = db.query(AgentUser).order_by(AgentUser.created_at.desc()).all()
    # Mask passwords
    return [
        {
            "id": u.id, 
            "tenant_id": u.tenant_id, 
            "username": u.username, 
            "role": u.role, 
            "created_at": u.created_at
        } 
        for u in users
    ]

class AgentUserCreate(BaseModel):
    tenant_id: str
    username: str
    password: str
    role: str = 'user'

@router.post("/agent-users")
def create_agent_user(req: AgentUserCreate, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    existing = db.query(AgentUser).filter(
        AgentUser.tenant_id == req.tenant_id,
        AgentUser.username == req.username
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe neste Tenant.")
        
    hashed = hashlib.sha256(req.password.encode('utf-8')).hexdigest()
    new_user = AgentUser(
        tenant_id=req.tenant_id,
        username=req.username,
        password_hash=hashed,
        role=req.role
    )
    db.add(new_user)
    db.commit()
    return {"success": True, "message": "Usuário criado com sucesso."}

class AgentUserUpdate(BaseModel):
    tenant_id: str
    username: str
    password: Optional[str] = None
    role: str

@router.put("/agent-users/{user_id}")
def update_agent_user(user_id: int, req: AgentUserUpdate, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    user = db.query(AgentUser).filter(AgentUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    user.tenant_id = req.tenant_id
    user.username = req.username
    user.role = req.role
    if req.password:
        user.password_hash = hashlib.sha256(req.password.encode('utf-8')).hexdigest()
    
    db.commit()
    return {"success": True, "message": "Usuário atualizado com sucesso."}

@router.delete("/agent-users/{user_id}")
def delete_agent_user(user_id: int, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    user = db.query(AgentUser).filter(AgentUser.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
    return {"success": True, "message": "Usuário removido com sucesso."}

# --- Endpoints de AgentRoles ---

class AgentRoleCreateUpdate(BaseModel):
    tenant_id: str
    name: str
    permissions: List[str]

@router.get("/agent-roles")
def get_agent_roles(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    roles = db.query(AgentRole).order_by(AgentRole.name.asc()).all()
    return [{"id": r.id, "tenant_id": r.tenant_id, "name": r.name, "permissions": r.permissions} for r in roles]

@router.post("/agent-roles")
def create_agent_role(req: AgentRoleCreateUpdate, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    new_role = AgentRole(tenant_id=req.tenant_id, name=req.name, permissions=req.permissions)
    db.add(new_role)
    db.commit()
    return {"success": True}

@router.put("/agent-roles/{role_id}")
def update_agent_role(role_id: int, req: AgentRoleCreateUpdate, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    role = db.query(AgentRole).filter(AgentRole.id == role_id).first()
    if role:
        role.tenant_id = req.tenant_id
        role.name = req.name
        role.permissions = req.permissions
        db.commit()
    return {"success": True}

@router.delete("/agent-roles/{role_id}")
def delete_agent_role(role_id: int, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    role = db.query(AgentRole).filter(AgentRole.id == role_id).first()
    if role:
        db.delete(role)
        db.commit()
    return {"success": True}
