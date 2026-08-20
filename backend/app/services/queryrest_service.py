"""
queryrest_service.py

Helper para chamar a QueryRest do Protheus.
A QueryRest aceita POST com {"cQuery": "SELECT ..."} e retorna lista JSON.
Suporta chamadas diretas via URL/credenciais e chamadas contextualizadas por tenant/portal.
"""
import re
import logging
import json
import os
import httpx
from typing import List, Dict, Any, Optional
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.services.protheus_service import execute_protheus_tool

logger = logging.getLogger("app.services.queryrest")

import base64
import hashlib

def _get_fernet() -> Fernet:
    key = os.getenv("FERNET_KEY", "").strip().encode()
    if key:
        try:
            return Fernet(key)
        except Exception:
            pass
    secret = os.getenv("JWT_SECRET") or os.getenv("ADMIN_JWT_SECRET") or "copilot-protheus-fernet-fallback-key"
    key_32bytes = hashlib.sha256(secret.encode()).digest()
    fallback_key = base64.urlsafe_b64encode(key_32bytes)
    return Fernet(fallback_key)


def _decrypt(encrypted: str) -> str:
    """Descriptografa senha armazenada com Fernet com fallback transparente."""
    if not encrypted:
        return ""
    try:
        return _get_fernet().decrypt(encrypted.encode()).decode()
    except Exception:
        return encrypted


def _parse_sanitized_json(text: str):
    if not text:
        return None
    import re
    clean_text = re.sub(r'[\x00-\x1f]', lambda m: '\\n' if m.group(0) in ('\n', '\r') else ('\\t' if m.group(0) == '\t' else f'\\u{ord(m.group(0)):04x}'), text)
    return json.loads(clean_text)



async def queryrest_exec_tenant(
    db: Session,
    tenant_id: str,
    company_id: int | str,
    query: str,
    environment_code: str,
) -> List[Dict[str, Any]]:
    """
    Executa uma consulta SQL nativa no Oracle do Protheus através do endpoint /QueryRest contextualizado por Tenant/Empresa.
    Conforme Diretrizes Globais do Agente no ambiente Cloud:
    1. Priorização de consultas SQL via endpoint /QueryRest para análises de dados.
    2. Proibido Inventar Valores: reporta claramente indisponibilidade ou falhas ao invés de simular dados.
    3. Respeito às regras de sintaxe do banco de dados Oracle.
    """
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório para execução via QueryRest.")
    if not environment_code or str(environment_code).strip().lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="environment_code é obrigatório para execução via QueryRest.")

    logger.info("[QueryRest Tenant] Executando consulta tenant=%s ambiente=%s company_id=%s", tenant_id, environment_code, company_id)
    
    from app.services.protheus_queryrest_client import ProtheusQueryRestClient, ProtheusQueryRestError

    try:
        client = ProtheusQueryRestClient(
            db=db,
            tenant_code=tenant_id,
            environment_code=str(environment_code).strip()
        )
        
        result_data = await client.execute(
            query=query,
            method="POST"
        )
    except ProtheusQueryRestError as e:
        logger.error(f"[QueryRest Tenant] Erro ao conectar ao portal REST /QueryRest (tenant={tenant_id}): status {e.status_code}")
        raise HTTPException(
            status_code=502,
            detail=f"Não foi possível se conectar à API /QueryRest do Protheus (tenant: {tenant_id}). Serviço offline ou inacessível."
        )
    except Exception:
        logger.error("[QueryRest Tenant] Erro inesperado tenant=%s ambiente=%s", tenant_id, environment_code)
        raise HTTPException(
            status_code=502,
            detail="Erro de conexão com QueryRest do Protheus."
        )

    if isinstance(result_data, dict):
        if "error" in result_data and result_data["error"]:
            raise HTTPException(status_code=400, detail=f"Erro reportado pelo ERP Protheus via /QueryRest: {result_data['error']}")
        if "errorCode" in result_data or "errorMessage" in result_data:
            err_msg = result_data.get("errorMessage", result_data.get("errorCode", "Erro na execução da query no ERP"))
            raise HTTPException(status_code=400, detail=f"Erro REST no Protheus via /QueryRest: {err_msg}")
        if "items" in result_data and isinstance(result_data["items"], list):
            return result_data["items"]
        if "data" in result_data and isinstance(result_data["data"], list):
            return result_data["data"]

    if isinstance(result_data, list):
        return result_data

    logger.warning(f"[QueryRest Tenant] Retorno sem estrutura compatível (items/data): {str(result_data)[:200]}")
    return []


# Alias de compatibilidade
queryrest_exec_async = queryrest_exec_tenant
