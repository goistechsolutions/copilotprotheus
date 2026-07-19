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
