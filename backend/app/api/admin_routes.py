from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
import os
import json
import dotenv
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import AuditLog, Tenant, Company
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
    """Retorna as chaves e valores configurados no .env (ocultando senhas parcialmente)"""
    config_dict = dotenv.dotenv_values(ENV_PATH)
    return {"configs": config_dict}

@router.post("/config")
def update_config(update: ConfigUpdate, admin: str = Depends(verify_admin)):
    """Atualiza uma chave no arquivo .env e no objeto settings em memória"""
    dotenv.set_key(ENV_PATH, update.key, update.value)
    os.environ[update.key] = update.value
    
    # Atualizar o objeto settings em memória (se o campo existir no schema do Settings)
    key_lower = update.key.lower()
    if hasattr(settings, key_lower):
        setattr(settings, key_lower, update.value)
        
    return {"success": True, "message": f"Chave {update.key} atualizada."}


# --- Endpoints de Tabelas (tables_config.json) ---

@router.get("/tables")
def get_tables(admin: str = Depends(verify_admin)):
    """Retorna as tabelas permitidas"""
    if not TABLES_CONFIG_PATH.exists():
        with open(TABLES_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_TABLES, f, indent=4)
        return {"tables": DEFAULT_TABLES}
        
    with open(TABLES_CONFIG_PATH, "r", encoding="utf-8") as f:
        tables = json.load(f)
    return {"tables": tables}

@router.post("/tables")
def update_tables(tables: list = Body(...), admin: str = Depends(verify_admin)):
    """Atualiza as tabelas permitidas"""
    with open(TABLES_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(tables, f, indent=4)
    return {"success": True, "message": "Tabelas atualizadas com sucesso."}


# --- Endpoints de Logs e Monitoramento ---

@router.get("/logs")
def get_logs(limit: int = 50, skip: int = 0, db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    """Retorna o histórico de conversas e logs de auditoria"""
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return {"logs": logs}
