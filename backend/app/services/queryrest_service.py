"""
queryrest_service.py

Helper para chamar a QueryRest do Protheus.
A QueryRest aceita POST com {"cQuery": "SELECT ..."} e retorna lista JSON.
Suporta chamadas diretas via URL/credenciais e chamadas contextualizadas por tenant/portal.
"""
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


def queryrest_exec(
    rest_url: str,
    user: str,
    encrypted_password: str,
    sql: str,
    timeout: int = 60,
) -> List[Dict[str, Any]]:
    """
    Executa um SELECT via QueryRest do Protheus através de conexão direta por URL e credenciais REST.

    Args:
        rest_url: URL base da API REST do Protheus
        user: usuário REST
        encrypted_password: senha criptografada com Fernet
        sql: SQL SELECT a executar (Oracle dialect)
        timeout: timeout em segundos

    Returns:
        Lista de dicts com o resultado.
    """
    password = _decrypt(encrypted_password)
    base = rest_url.rstrip("/")
    url = f"{base}/QueryRest"

    logger.info(f"[QueryRest Direto] GET/POST {url} — SQL: {sql[:120]}...")

    resp = None
    # 1. Tenta GET com cQuery na URL (Método padrão Protheus REST Cloud)
    try:
        with httpx.Client(timeout=timeout, verify=False) as client:
            resp = client.get(
                url,
                params={"cQuery": sql},
                auth=(user, password),
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
                if isinstance(data, dict):
                    return data.get("items") or data.get("data") or []
    except Exception as e:
        logger.warning(f"[QueryRest Direto] GET falhou ({e}). Tentando POST fallback...")

    # 2. Fallback POST com JSON body
    try:
        with httpx.Client(timeout=timeout, verify=False) as client:
            resp = client.post(
                url,
                json={"cQuery": sql},
                auth=(user, password),
                headers={"Content-Type": "application/json"},
            )
    except httpx.RequestError as e:
        raise RuntimeError(f"QueryRest offline ou inacessível ({url}): {e}")

    if resp.status_code != 200:
        raise RuntimeError(
            f"QueryRest retornou HTTP {resp.status_code} para {url}: {resp.text[:300]}"
        )

    data = resp.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("items") or data.get("data") or data.get("result") or []
    return []


async def queryrest_exec_tenant(db: Session, tenant_id: str, company_id: int | str, query: str) -> List[Dict[str, Any]]:
    """
    Executa uma consulta SQL nativa no Oracle do Protheus através do endpoint /QueryRest contextualizado por Tenant/Empresa.
    Conforme Diretrizes Globais do Agente no ambiente Cloud:
    1. Priorização de consultas SQL via endpoint /QueryRest para análises de dados.
    2. Proibido Inventar Valores: reporta claramente indisponibilidade ou falhas ao invés de simular dados.
    3. Respeito às regras de sintaxe do banco de dados Oracle.
    """
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório para execução via QueryRest.")

    logger.info(f"[QueryRest Tenant] Executando consulta para tenant={tenant_id}, company_id={company_id}: {query[:150]}...")
    
    try:
        response_str = await execute_protheus_tool(
            endpoint="QueryRest",
            query_params={"cQuery": query},
            tenant_id=tenant_id,
            context={"company_id": str(company_id)}
        )
    except Exception as e:
        logger.error(f"[QueryRest Tenant] Erro ao conectar ao portal REST /QueryRest (tenant={tenant_id}): {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Não foi possível se conectar à API /QueryRest do Protheus (tenant: {tenant_id}). Serviço offline ou inacessível na nuvem: {str(e)}"
        )

    try:
        result_data = json.loads(response_str)
    except Exception as e:
        logger.error(f"[QueryRest Tenant] Resposta não-JSON retornada pelo Protheus /QueryRest: {response_str[:200]}")
        raise HTTPException(
            status_code=502,
            detail="Resposta inválida (não-JSON) retornada pelo servidor do ERP Protheus via /QueryRest na nuvem."
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
