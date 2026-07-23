import os
import json
import time
import httpx
import logging
import uuid
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("app.protheus")

from app.models.knowledge import Tenant, Company, Environment, Connector
from app.core.security import decrypt_password
from app.db.database import SessionLocal

_OAUTH2_TOKENS = {} # cache: {tenant_id: (token, expiry)}

def get_tenant_config(tenant_id: str) -> dict:
    """
    Busca as credenciais do Protheus do tenant_id no banco de dados e as decodifica.
    Prioriza Connector + Environment da Fase 3/4.
    """
    db = SessionLocal()
    try:
        tenant_uuid = None
        try:
            tenant_uuid = uuid.UUID(tenant_id)
            tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
        except ValueError:
            tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
            if tenant:
                tenant_uuid = tenant.id

        if not tenant:
            raise ValueError(f"Tenant não encontrado para a chave: {tenant_id}")

        # Busca Conector
        connector = db.query(Connector).filter(
            Connector.tenant_id == tenant_uuid,
            Connector.connector_type == 'protheus',
            Connector.status == 'active'
        ).first()

        if connector:
            rest_url = connector.base_url
            if not rest_url and connector.env_id:
                env = db.query(Environment).filter(Environment.id == connector.env_id).first()
                if env:
                    rest_url = env.api_base_url
            
            # Decodificando secret_ref (esperado formato user:encrypted_pass ou JSON)
            user = ""
            pwd = ""
            if connector.secret_ref:
                if connector.secret_ref.startswith("{"):
                    try:
                        sec = json.loads(connector.secret_ref)
                        user = sec.get("user", "")
                        pwd = decrypt_password(sec.get("password", ""))
                    except:
                        pass
                elif ":" in connector.secret_ref:
                    parts = connector.secret_ref.split(":", 1)
                    user = parts[0]
                    pwd = decrypt_password(parts[1])

            return {
                "rest_url": rest_url or "",
                "webapp_url": "",
                "vscode_server_url": "",
                "user": user,
                "password": pwd,
                "auth_mode": connector.auth_type or "basic"
            }
            
    except Exception as e:
        logger.error(f"Erro ao buscar configuracoes do tenant {tenant_id}: {e}")
    finally:
        db.close()
        
    raise ValueError(f"Configurações do Protheus não encontradas no Banco de Dados para o tenant_id: {tenant_id}.")

async def descobrir_apis_protheus(palavra_chave: str) -> str:
    cache_path = os.path.join(os.path.dirname(__file__), "endpoints_cache.json")
    if not os.path.exists(cache_path):
        return json.dumps({"error": "Cache de endpoints nao encontrado."})
    
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            endpoints = json.load(f)
        
        resultados = []
        palavra_chave = palavra_chave.lower()
        for ep in endpoints:
            ep_path = ep.get("endpoint", "").lower()
            if palavra_chave in ep_path:
                resultados.append({
                    "endpoint": ep.get("endpoint"),
                    "methods": [m.get("method") for m in ep.get("methods", [])]
                })
                if len(resultados) >= 15:
                    break
                    
        if not resultados:
            return json.dumps({"message": f"Nenhuma API encontrada para o termo '{palavra_chave}'"})
            
        return json.dumps(resultados)
    except Exception as e:
        return json.dumps({"error": f"Erro ao ler cache: {str(e)}"})

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=6),
    retry=retry_if_exception_type(httpx.HTTPError),
    reraise=True
)
async def get_protheus_token(tenant_id: str, user: str = None, password: str = None) -> str:
    global _OAUTH2_TOKENS
    now = time.time()
    
    if user and password:
        cache_key = f"{tenant_id}:{user}:{password}"
    else:
        cache_key = tenant_id

    if cache_key in _OAUTH2_TOKENS:
        token, expiry = _OAUTH2_TOKENS[cache_key]
        if now < expiry:
            return token
            
    config = get_tenant_config(tenant_id)
    rest_url = config['rest_url'].strip()
    if not rest_url.startswith("http://") and not rest_url.startswith("https://"):
        rest_url = "https://" + rest_url
    token_url = f"{rest_url.rstrip('/')}/api/oauth2/v1/token"
    payload = {
        "grant_type": "password",
        "username": user if user else config['user'],
        "password": password if password else config['password']
    }
    
    import urllib3
    urllib3.disable_warnings()
    
    logger.info(f"Obtendo novo token OAuth2 do Protheus para o tenant {tenant_id} (user={payload['username']})...")
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, verify=False) as client:
        resp = await client.post(token_url, data=payload)
        resp.raise_for_status()
        data = resp.json()
        access_token = data.get("access_token")
        expires_in = data.get("expires_in", 3600)
        _OAUTH2_TOKENS[cache_key] = (access_token, now + expires_in - 60)
        return access_token

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=6),
    retry=retry_if_exception_type(httpx.HTTPError),
    reraise=True
)
async def _execute_http_get_with_retry(url: str, params: dict, headers: dict) -> str:
    logger.info(f"Chamando endpoint Protheus (GET) com retry: {url}")
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, verify=False) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.text

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=6),
    retry=retry_if_exception_type(httpx.HTTPError),
    reraise=True
)
async def _execute_http_post_with_retry(url: str, json_data: dict, headers: dict) -> str:
    logger.info(f"Chamando endpoint Protheus (POST) com retry: {url}")
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, verify=False) as client:
        resp = await client.post(url, json=json_data, headers=headers)
        resp.raise_for_status()
        return resp.text


async def execute_protheus_tool(endpoint: str, query_params: dict, tenant_id: str = "default", context: dict = None) -> str:
    config = get_tenant_config(tenant_id)
    rest_url = config['rest_url'].strip()
    if not rest_url.startswith("http://") and not rest_url.startswith("https://"):
        rest_url = "https://" + rest_url
        
    url = f"{rest_url.rstrip('/')}/{endpoint.lstrip('/')}"
    
    user = context.get("user") if context else None
    password = context.get("password") if context else None
    protheus_token = context.get("protheus_token") if context else None
    
    auth_mode = config.get("auth_mode", "basic")
    headers = {
        "Content-Type": "application/json"
    }
    
    if protheus_token:
        headers["Authorization"] = f"Bearer {protheus_token}"
        logger.info(f"Usando token de sessao Protheus fornecido dinamicamente para {user} no tenant {tenant_id}")
    elif auth_mode == "basic":
        import base64
        u = user if user else config['user']
        p = password if password else config['password']
        cred = f"{u}:{p}".encode("utf-8")
        b64_cred = base64.b64encode(cred).decode("utf-8")
        headers["Authorization"] = f"Basic {b64_cred}"
        logger.info(f"Usando autenticacao Basic para {u} no tenant {tenant_id}")
    else:
        try:
            token = await get_protheus_token(tenant_id, user=user, password=password)
            headers["Authorization"] = f"Bearer {token}"
        except Exception as e:
            logger.error(f"Falha na autenticacao OAuth2 do tenant {tenant_id} (user={user}): {e}")
            return json.dumps({"error": f"Falha na autenticacao OAuth2: {str(e)}"})
    
    import urllib3
    urllib3.disable_warnings()
    
    try:
        if endpoint.lower() == "queryrest" or endpoint.lower().endswith("/queryrest"):
            return await _execute_http_post_with_retry(url, query_params, headers)
        else:
            return await _execute_http_get_with_retry(url, query_params, headers)
    except httpx.HTTPStatusError as e:
        error_body = e.response.text
        logger.error(f"Falha HTTP {e.response.status_code} ao chamar Protheus ({url}): {error_body}")
        return json.dumps({"error": f"Erro {e.response.status_code} do Protheus: {error_body}"})
    except Exception as e:
        logger.error(f"Falha após retries ao chamar Protheus ({url}) para o tenant {tenant_id}: {e}")
        return json.dumps({"error": f"Falha persistente ao chamar Protheus ({url}): {str(e)}"})
