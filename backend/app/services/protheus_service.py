import os
import re
import json
import time
import httpx
import logging
import uuid
from sqlalchemy import text
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("app.protheus")

from app.core.security import decrypt_password
from app.db.database import SessionLocal

_OAUTH2_TOKENS = {} # cache: {tenant_id: (token, expiry)}

def get_tenant_config(tenant_id: str) -> dict:
    """
    Busca as credenciais do Protheus do tenant_id no banco de dados.
    1. Consulta na tabela company_info dentro do schema exclusivo do tenant ("{clean_tenant}".company_info)
    2. Fallback nas variáveis de ambiente globais (.env)
    """
    db = SessionLocal()
    try:
        from app.db.database import ensure_tenant_tables, resolve_clean_tenant
        clean_tenant = resolve_clean_tenant(db, tenant_id)

        if clean_tenant and clean_tenant != "public":
            try:
                ensure_tenant_tables(db, clean_tenant)
                res = db.execute(
                    text(f'SELECT protheus_rest_url, protheus_usuario, encrypted_protheus_password, webapp_url, auth_mode FROM "{clean_tenant}".company_info WHERE protheus_rest_url IS NOT NULL AND protheus_rest_url != \'\' LIMIT 1')
                ).first()
                if res and res[0]:
                    pwd = ""
                    if res[2]:
                        try:
                            pwd = decrypt_password(res[2])
                        except Exception:
                            pwd = res[2]
                    return {
                        "rest_url": res[0].rstrip("/"),
                        "webapp_url": res[3] or "",
                        "vscode_server_url": "",
                        "user": res[1] or "",
                        "password": pwd,
                        "auth_mode": res[4] or "basic"
                    }
            except Exception as schema_err:
                logger.warning(f"Aviso ao consultar company_info do schema {clean_tenant}: {schema_err}")

        # Fallback nas variáveis de ambiente (.env / Globais)
        if getattr(settings, "protheus_rest_url", None):
            return {
                "rest_url": settings.protheus_rest_url.rstrip("/"),
                "webapp_url": getattr(settings, "protheus_webapp_url", "") or "",
                "vscode_server_url": "",
                "user": getattr(settings, "protheus_usuario", "") or "",
                "password": getattr(settings, "protheus_password", "") or "",
                "auth_mode": getattr(settings, "protheus_auth_mode", "basic") or "basic"
            }

        return {
            "rest_url": "",
            "webapp_url": "",
            "vscode_server_url": "",
            "user": "",
            "password": "",
            "auth_mode": "basic"
        }
    except Exception as err:
        logger.error(f"Erro ao buscar configuracoes do tenant {tenant_id}: {err}")
        return {
            "rest_url": "",
            "webapp_url": "",
            "vscode_server_url": "",
            "user": "",
            "password": "",
            "auth_mode": "basic"
        }
    finally:
        db.close()

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

def _sanitize_response_text(text: str) -> str:
    if not text:
        return text
    import re
    return re.sub(r'[\x00-\x1f]', lambda m: '\\n' if m.group(0) in ('\n', '\r') else ('\\t' if m.group(0) == '\t' else f'\\u{ord(m.group(0)):04x}'), text)

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
        return _sanitize_response_text(resp.text)

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
        return _sanitize_response_text(resp.text)


def _enforce_query_rules(cQuery: str, tenant_id: str, context: dict = None):
    from app.db.database import get_tenant_session
    from app.models.knowledge import TenantAllowedTable, QueryUsageCounter, TenantContract, Company, Tenant
    import uuid
    import re
    
    db = get_tenant_session(tenant_id)
    try:
        tid = str(tenant_id).strip() if tenant_id else "default"
        tenant = db.query(Tenant).filter(Tenant.tenant_code == tid).first()
        if not tenant and tid.isdigit():
            tenant = db.query(Tenant).filter(Tenant.id == int(tid)).first()
        if tenant:
            tid = str(tenant.tenant_code)
            
        # 1. Verifica quota
        if tid:
            try:
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.tenant_id == tid).first()
                if usage and usage.total_queries >= (usage.overage_queries or 999999):
                    raise Exception(f"Quota de consultas atingida ({usage.total_queries}).")
            except Exception as e:
                if "Quota" in str(e): raise e

        # 2. Verifica tabelas
        # Se a tabela est no dicionrio do tenant, ela DEVE estar na whitelist (TenantAllowedTable) e ativa
        blocked_tables = db.query(DictionaryTable.physical_name).outerjoin(
            TenantAllowedTable, 
            (TenantAllowedTable.table_name == DictionaryTable.physical_name) & 
            (TenantAllowedTable.tenant_id == tid)
        ).filter(
            DictionaryTable.tenant_id == tid,
            DictionaryTable.active_flag == True,
            (TenantAllowedTable.id == None) | (TenantAllowedTable.active == False)
        ).all()
        
        upper_query = cQuery.upper()
        for (ptable,) in blocked_tables:
            if ptable and len(ptable) >= 3:
                if re.search(r'\b' + re.escape(ptable.upper()) + r'\b', upper_query):
                    raise Exception(f"Acesso negado: A tabela {ptable} nao esta liberada para este tenant.")
        
    finally:
        db.close()


def _log_query_audit(tenant_id: str, context: dict, query: str, status: str, records_returned: int, response_time_ms: int, error_msg: str = None):
    from app.db.database import get_tenant_session
    from app.models.knowledge import AgentQueryAudit, QueryUsageCounter
    
    db = get_tenant_session(tenant_id)
    try:
        tid = str(tenant_id).strip() if tenant_id else "default"
        company_id = context.get("company_id") if context else None
        cid = None
        if company_id:
            try:
                cid = int(company_id)
            except (ValueError, TypeError):
                cid = None
            
        if tid:
            audit = AgentQueryAudit(
                tenant_id=tid,
                company_id=cid,
                user_id=None,
                generated_sql=query,
                execution_status=status,
                rows_returned=records_returned,
                response_time_ms=response_time_ms,
                blocked_reason=error_msg[:250] if error_msg else None
            )
            db.add(audit)
            
            if status == "success":
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.tenant_id == tid).first()
                if usage:
                    usage.total_queries += 1
            
            db.commit()
    except Exception as e:
        logger.error(f"Erro ao registrar auditoria de query: {e}")
    finally:
        db.close()

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
            cQuery = query_params.get("cQuery", "") or query_params.get("query", "") or query_params.get("cquery", "")
            if cQuery:
                try:
                    _enforce_query_rules(cQuery, tenant_id, context)
                except Exception as enforce_err:
                    _log_query_audit(tenant_id, context or {}, cQuery, "blocked", 0, 0, str(enforce_err))
                    return json.dumps({"error": str(enforce_err)})
            
            start_t = time.time()
            try:
                # Tenta GET primeiro com cQuery via Query String (padrão canônico do Protheus REST em Cloud)
                try:
                    res_text = await _execute_http_get_with_retry(url, {"cQuery": cQuery}, headers)
                except Exception as get_err:
                    logger.warning(f"QueryRest GET falhou ({get_err}). Tentando POST fallback...")
                    res_text = await _execute_http_post_with_retry(url, query_params, headers)
                elapsed = int((time.time() - start_t) * 1000)
                
                records = 0
                try:
                    parsed = json.loads(res_text)
                    if isinstance(parsed, dict) and "items" in parsed:
                        records = len(parsed["items"])
                    elif isinstance(parsed, list):
                        records = len(parsed)
                except:
                    pass
                
                _log_query_audit(tenant_id, context or {}, cQuery, "success", records, elapsed)
                return res_text
            except Exception as req_err:
                elapsed = int((time.time() - start_t) * 1000)
                _log_query_audit(tenant_id, context or {}, cQuery, "error", 0, elapsed, str(req_err))
                raise req_err
        else:
            return await _execute_http_get_with_retry(url, query_params, headers)
    except httpx.HTTPStatusError as e:
        error_body = e.response.text
        logger.error(f"Falha HTTP {e.response.status_code} ao chamar Protheus ({url}): {error_body}")
        return json.dumps({"error": f"Erro {e.response.status_code} do Protheus: {error_body}"})
    except Exception as e:
        logger.error(f"Falha após retries ao chamar Protheus ({url}) para o tenant {tenant_id}: {e}")
        return json.dumps({"error": f"Falha persistente ao chamar Protheus ({url}): {str(e)}"})
