"""
queryrest_service.py

Helper para chamar a QueryRest do Protheus.
A QueryRest aceita POST com {"cQuery": "SELECT ..."} e retorna lista JSON.
"""
import logging
import httpx
from typing import List, Dict, Any, Optional
from cryptography.fernet import Fernet
import os

logger = logging.getLogger("app.services.queryrest")

FERNET_KEY = os.getenv("FERNET_KEY", "").encode()


def _decrypt(encrypted: str) -> str:
    """Descriptografa senha armazenada com Fernet."""
    if not FERNET_KEY:
        raise RuntimeError("FERNET_KEY não configurada.")
    return Fernet(FERNET_KEY).decrypt(encrypted.encode()).decode()


def queryrest_exec(
    rest_url: str,
    user: str,
    encrypted_password: str,
    sql: str,
    timeout: int = 60,
) -> List[Dict[str, Any]]:
    """
    Executa um SELECT via QueryRest do Protheus.

    Args:
        rest_url: URL base da API REST do Protheus (ex: https://erp.empresa.com.br)
        user: usuário REST
        encrypted_password: senha criptografada com Fernet
        sql: SQL SELECT a executar
        timeout: timeout em segundos

    Returns:
        Lista de dicts com o resultado.

    Raises:
        RuntimeError: se a QueryRest retornar erro ou estiver offline.
    """
    password = _decrypt(encrypted_password)
    base = rest_url.rstrip("/")
    url  = f"{base}/QueryRest"

    logger.info(f"[QueryRest] POST {url} — SQL: {sql[:120]}...")

    try:
        with httpx.Client(timeout=timeout) as client:
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

    # A QueryRest retorna lista direta ou dentro de 'items'/'result'
    if isinstance(data, list):
        return data
    return data.get("items") or data.get("result") or []
