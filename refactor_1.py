import os
import re

def fix_tenant_routes():
    path = 'backend/app/api/tenant_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_sync_func = '''
async def _sync_protheus_connection(db: Session, tenant_code: str, conn_info: dict):
    """Grava a conexo cifrada e valida OAuth2 pela fachada nica de integrao."""
    import json
    from app.db.database import resolve_clean_tenant
    
    clean_tenant = resolve_clean_tenant(tenant_code)
    env_code = conn_info["env_code"]
    rest_url = conn_info["rest_url"]
    username = conn_info["username"]
    password = conn_info["password"]
    auth_mode = conn_info["auth_mode"]
    ProtheusIntegrationService._validate_base_url(rest_url)

    # 1. Garante que o ambiente existe
    env_id = db.execute(
        text(f"""
            INSERT INTO "{clean_tenant}".environments (environment_code, environment_name, status)
            VALUES (:env_code, :env_code, 'ACTIVE')
            ON CONFLICT (environment_code) DO UPDATE SET status = 'ACTIVE'
            RETURNING id
        """),
        {"env_code": env_code}
    ).scalar()

    # 2. Busca a senha existente caso no tenha sido enviada
    existing_secret = db.execute(
        text(f"""
            SELECT secret_ref
            FROM "{clean_tenant}".protheus_connections
            WHERE environment_id = :env_id
            LIMIT 1
        """),
        {"env_id": env_id}
    ).scalar()

    existing_password = None
    if existing_secret:
        try:
            sec_data = json.loads(existing_secret)
            existing_password = sec_data.get("encrypted_protheus_password")
        except:
            pass

    if not password and not existing_password:
        raise HTTPException(
            status_code=400,
            detail="Senha REST Protheus  obrigatria para uma nova conexo.",
        )

    enc_pw = encrypt_password(password) if password else existing_password

    new_secret = {
        "protheus_username": username,
        "encrypted_protheus_password": enc_pw,
    }
    if existing_secret:
        try:
            sec_data = json.loads(existing_secret)
            # Preserve tokens se existirem
            new_secret["encrypted_access_token"] = sec_data.get("encrypted_access_token")
            new_secret["encrypted_refresh_token"] = sec_data.get("encrypted_refresh_token")
            new_secret["access_token_expires_at"] = sec_data.get("access_token_expires_at")
            new_secret["token_updated_at"] = sec_data.get("token_updated_at")
        except:
            pass

    upsert_sql = text(f"""
        INSERT INTO "{clean_tenant}".protheus_connections (
            environment_id, base_rest_url, auth_mode, secret_ref, active
        ) VALUES (
            :env_id, :url, :auth, :sec_ref, TRUE
        ) ON CONFLICT (environment_id) DO UPDATE SET
            base_rest_url = EXCLUDED.base_rest_url,
            auth_mode = EXCLUDED.auth_mode,
            secret_ref = EXCLUDED.secret_ref,
            active = TRUE,
            updated_at = NOW();
    """)

    db.execute(upsert_sql, {
        "env_id": env_id,
        "url": rest_url,
        "auth": auth_mode,
        "sec_ref": json.dumps(new_secret)
    })
    db.commit()

    try:
        invalidate_access_token(db, clean_tenant, env_code)
        context = ProtheusContext(tenant_code=clean_tenant, environment_code=env_code)
        await ProtheusIntegrationService(db, context).authenticate()
    except IntegrationFailure as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Falha na autenticao com o ERP ({env_code}): {exc.message}"
        ) from exc
'''
    # Replace _sync_protheus_connection
    content = re.sub(
        r'async def _sync_protheus_connection\(db: Session, tenant_code: str, conn_info: dict\):.*?except IntegrationFailure as exc:.*?raise HTTPException.*?from exc',
        new_sync_func.strip(),
        content,
        flags=re.DOTALL
    )
    
    # Replace _to_tenant_dict
    new_to_dict = '''
def _to_tenant_dict(db: Session, t: Tenant) -> dict:
    from app.db.database import resolve_clean_tenant
    import json
    import datetime
    clean_tenant = resolve_clean_tenant(t.tenant_code)
    try:
        conn = db.execute(text(f"""
            SELECT 
                c.base_rest_url, 
                c.auth_mode, 
                c.secret_ref,
                e.environment_code
            FROM "{clean_tenant}".protheus_connections c
            JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
            WHERE c.active = TRUE
            ORDER BY c.updated_at DESC 
            LIMIT 1
        """)).mappings().first()
    except Exception:
        conn = None

    sec_data = {}
    if conn and conn["secret_ref"]:
        try:
            sec_data = json.loads(conn["secret_ref"])
        except:
            pass

    rest_url = conn["base_rest_url"] if conn else ""
    auth_mode = conn["auth_mode"] if conn else "oauth"
    env_code = conn["environment_code"] if conn else ""
    user = sec_data.get("protheus_username", "")
    has_pw = bool(sec_data.get("encrypted_protheus_password"))
    has_tok = bool(sec_data.get("encrypted_access_token"))
    exp_at = sec_data.get("access_token_expires_at")
    
    conn_obj = {
        "environment_code": env_code,
        "base_rest_url": rest_url,
        "auth_mode": auth_mode,
        "protheus_username": user,
        "has_password": has_pw,
        "has_access_token": has_tok,
        "access_token_expires_at": exp_at,
    }

    return {
        "id": str(t.id),
        "tenant_code": t.tenant_code,
        "name": t.tenant_name,
        "schema_name": t.schema_name,
        "status": t.status,
        "plan_code": t.plan_code,
        "cnpj": t.cnpj,
        "licenca_uso": t.licenca_uso,
        "protheus_webapp_url": t.webapp_url,
        "system_prompt": t.system_prompt,
        "temperature": t.temperature,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "connection": conn_obj if env_code else None
    }
'''
    content = re.sub(
        r'def _to_tenant_dict\(db: Session, t: Tenant\) -> dict:.*?return {.*?}',
        new_to_dict.strip(),
        content,
        flags=re.DOTALL
    )
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_tenant_routes()
