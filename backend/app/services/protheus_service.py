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
    Consulta na seguinte ordem de prioridade:
    1. Connector (table connectors) / Environment
    2. Tenant (table tenants) - protheus_rest_url configurado no cadastro de Clientes
    3. Company (table companies) - protheus_rest_url configurada na Empresa vinculada
    4. Fallback nas variáveis de ambiente globais se tenant for default ou em fallback
    """
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == str(tenant_id)).first()
        if not tenant:
            tenant = db.query(Tenant).filter(Tenant.tenant_code == str(tenant_id)).first()
            
        tenant_key = str(tenant.id if tenant else tenant_id)

        # 1. Busca na tabela Connector (V4)
        connector = db.query(Connector).filter(
            (Connector.tenant_id == tenant_key) | (Connector.tenant_id == str(tenant_id)),
            Connector.connector_type.ilike('%protheus%'),
            Connector.status == 'active'
        ).first()

        if connector:
            rest_url = connector.base_url
            if not rest_url and connector.env_id:
                env = db.query(Environment).filter(Environment.id == connector.env_id).first()
                if env:
                    rest_url = env.api_base_url
            
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

            if rest_url:
                return {
                    "rest_url": rest_url.rstrip("/"),
                    "webapp_url": "",
                    "vscode_server_url": "",
                    "user": user,
                    "password": pwd,
                    "auth_mode": connector.auth_type or "basic"
                }

        # 2. Busca nas configurações diretas no cadastro do Cliente (tabela tenants)
        if tenant and tenant.protheus_rest_url:
            pwd = ""
            if tenant.encrypted_protheus_password:
                pwd = decrypt_password(tenant.encrypted_protheus_password)
            return {
                "rest_url": tenant.protheus_rest_url.rstrip("/"),
                "webapp_url": "",
                "vscode_server_url": "",
                "user": tenant.protheus_user or "",
                "password": pwd,
                "auth_mode": tenant.auth_mode or "basic"
            }

        # 3. Busca nas configurações da Empresa associada (tabela companies)
        company = db.query(Company).filter(
            (Company.tenant_id == tenant_key) | (Company.tenant_id == str(tenant_id)),
            Company.protheus_rest_url != None,
            Company.protheus_rest_url != ""
        ).first()
        
        if company and company.protheus_rest_url:
            pwd = ""
            enc_pwd = getattr(company, 'encrypted_protheus_password', None) or getattr(company, 'protheus_password', None)
            if enc_pwd:
                try:
                    pwd = decrypt_password(enc_pwd)
                except Exception as e:
                    logger.error(f"Erro ao decriptar senha da empresa {company.id}: {e}")
            return {
                "rest_url": company.protheus_rest_url.rstrip("/"),
                "webapp_url": company.protheus_webapp_url or "",
                "vscode_server_url": "",
                "user": company.protheus_usuario or "",
                "password": pwd,
                "auth_mode": "basic"
            }

        # 4. Fallback nas variáveis de ambiente (.env / Globais)
        if str(tenant_id).lower() in ["default", "admin", "1", tenant_key.lower()] and settings.protheus_rest_url:
            return {
                "rest_url": settings.protheus_rest_url.rstrip("/"),
                "webapp_url": getattr(settings, "protheus_webapp_url", ""),
                "vscode_server_url": "",
                "user": getattr(settings, "protheus_user", "") or "admin",
                "password": getattr(settings, "protheus_password", "") or "",
                "auth_mode": "basic"
            }

    except Exception as e:
        logger.error(f"Erro ao buscar configuracoes do tenant {tenant_id}: {e}")
    finally:
        db.close()
        
    raise ValueError(f"Configurações do Protheus (URL REST e credenciais) não encontradas no Banco de Dados para o cliente (tenant_id): {tenant_id}. Por favor, verifique se no cadastro do Cliente ({tenant_id}) ou Conector a URL REST do Protheus foi preenchida.")

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


def _enforce_query_rules(cQuery: str, tenant_id: str, context: dict = None):
    from app.db.database import SessionLocal
    from app.models.knowledge import TenantDictionaryTable, V4TenantAllowedTable, DictionarySnapshot, QueryUsageCounter, TenantContract, Company
    import uuid
    import re
    
    db = SessionLocal()
    try:
        try:
            tid = uuid.UUID(tenant_id)
        except:
            tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
            if not tenant:
                return # Can't enforce if no tenant
            tid = tenant.id
            
        # 1. Verifica quota
        company_id = context.get("company_id") if context else None
        if company_id:
            try:
                cid = uuid.UUID(company_id)
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.company_id == cid).first()
                if usage and usage.current_queries >= usage.max_queries:
                    raise Exception(f"Quota de consultas atingida ({usage.current_queries}/{usage.max_queries}).")
            except Exception as e:
                if "Quota" in str(e): raise e
        
        # 2. Verifica tabelas
        latest_snap = db.query(DictionarySnapshot).filter(
            DictionarySnapshot.tenant_id == tid, 
            DictionarySnapshot.sync_status == 'completed'
        ).order_by(DictionarySnapshot.started_at.desc()).first()
        
        if latest_snap:
            blocked_tables = db.query(TenantDictionaryTable.physical_name).outerjoin(
                V4TenantAllowedTable, 
                (V4TenantAllowedTable.table_id == TenantDictionaryTable.id) & 
                (V4TenantAllowedTable.snapshot_id == latest_snap.id)
            ).filter(
                TenantDictionaryTable.snapshot_id == latest_snap.id,
                (V4TenantAllowedTable.allowed == False) | (V4TenantAllowedTable.allowed == None)
            ).all()
            
            upper_query = cQuery.upper()
            for (ptable,) in blocked_tables:
                if ptable and len(ptable) >= 3:
                    if re.search(r'\b' + re.escape(ptable.upper()) + r'\b', upper_query):
                        raise Exception(f"Acesso negado: A tabela {ptable} nao esta liberada para este tenant.")
        
    finally:
        db.close()


def _log_query_audit(tenant_id: str, context: dict, query: str, status: str, records_returned: int, response_time_ms: int, error_msg: str = None):
    from app.db.database import SessionLocal
    from app.models.knowledge import AgentQueryAudit, QueryUsageCounter
    import uuid
    
    db = SessionLocal()
    try:
        try:
            tid = uuid.UUID(tenant_id)
        except:
            tid = None
            
        company_id = context.get("company_id") if context else None
        cid = None
        if company_id:
            try: cid = uuid.UUID(company_id)
            except: pass
            
        if tid:
            audit = AgentQueryAudit(
                tenant_id=tid,
                company_id=cid,
                user_id=None,
                query_sql=query,
                status=status,
                records_returned=records_returned,
                response_time_ms=response_time_ms,
                error_message=error_msg
            )
            db.add(audit)
            
            if status == "success" and cid:
                usage = db.query(QueryUsageCounter).filter(QueryUsageCounter.company_id == cid).first()
                if usage:
                    usage.current_queries += 1
            
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
