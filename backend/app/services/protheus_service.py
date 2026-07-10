import os
import json
import time
import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("app.protheus")

from app.models.knowledge import Tenant
from app.core.security import decrypt_password
from app.db.database import SessionLocal

_OAUTH2_TOKENS = {} # cache: {tenant_id: (token, expiry)}

def get_tenant_config(tenant_id: str) -> dict:
    """
    Busca as credenciais do Protheus do tenant_id no banco de dados e as decodifica.
    Caso não encontre, faz fallback para as configurações globais do .env.
    """
    from app.models.knowledge import Company
    db = SessionLocal()
    try:
        # Busca no Company primeiro (SaaS)
        company = db.query(Company).filter(Company.protheus_grupo == tenant_id).first()
        if company and company.protheus_rest_url:
            return {
                "rest_url": company.protheus_rest_url,
                "user": company.protheus_usuario or settings.protheus_user,
                "password": settings.protheus_password, # Fallback, pois a senha do usuario e passada dinamicamente
                "auth_mode": "basic"
            }
            
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            return {
                "rest_url": tenant.protheus_rest_url,
                "user": tenant.protheus_user,
                "password": decrypt_password(tenant.encrypted_protheus_password),
                "auth_mode": tenant.auth_mode or "basic"
            }
    except Exception as e:
        logger.error(f"Erro ao buscar configuracoes do tenant {tenant_id}: {e}")
    finally:
        db.close()
        
    raise ValueError(f"Configurações do Protheus não encontradas para o tenant_id: {tenant_id}")

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
    
    # Se recebermos usuário e senha do contexto logado, usamos como chave de cache
    if user and password:
        cache_key = f"{tenant_id}:{user}:{password}"
    else:
        cache_key = tenant_id

    if cache_key in _OAUTH2_TOKENS:
        token, expiry = _OAUTH2_TOKENS[cache_key]
        if now < expiry:
            return token
            
    config = get_tenant_config(tenant_id)
    token_url = f"{config['rest_url'].rstrip('/')}/api/oauth2/v1/token"
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
    logger.info(f"Chamando endpoint Protheus com retry: {url}")
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, verify=False) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.text

async def execute_protheus_tool(endpoint: str, query_params: dict, tenant_id: str = "default", context: dict = None) -> str:
    config = get_tenant_config(tenant_id)
    url = f"{config['rest_url'].rstrip('/')}/{endpoint.lstrip('/')}"
    
    # Extrai credenciais dinâmicas do contexto do usuário
    user = context.get("user") if context else None
    password = context.get("password") if context else None
    protheus_token = context.get("protheus_token") if context else None
    
    token = None
    if protheus_token:
        # Se o token da sessão ativa do Protheus foi fornecido, usa diretamente!
        token = protheus_token
        logger.info(f"Usando token de sessao Protheus fornecido dinamicamente para {user} no tenant {tenant_id}")
    else:
        try:
            token = await get_protheus_token(tenant_id, user=user, password=password)
        except Exception as e:
            logger.error(f"Falha na autenticacao OAuth2 do tenant {tenant_id} (user={user}): {e}")
            return json.dumps({"error": f"Falha na autenticacao OAuth2: {str(e)}"})
        
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    import urllib3
    urllib3.disable_warnings()
    
    try:
        return await _execute_http_get_with_retry(url, query_params, headers)
    except Exception as e:
        logger.error(f"Falha após retries ao chamar Protheus ({url}) para o tenant {tenant_id}: {e}")
        return json.dumps({"error": f"Falha persistente ao chamar Protheus ({url}): {str(e)}"})

