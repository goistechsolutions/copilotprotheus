import re
import os

filepath = r"C:\projeto\copilotprotheus\backend\app\api\tenant_routes.py"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update _to_tenant_dict
new_to_tenant_dict = """def _to_tenant_dict(db: Session, t: Tenant) -> dict:
    conn = db.execute(text("SELECT base_rest_url, auth_mode, protheus_username FROM public.protheus_rest_connections WHERE tenant_code = :tc AND environment_code = 'default'"), {"tc": t.tenant_code}).mappings().first()
    rest_url = conn["base_rest_url"] if conn else ""
    user = conn["protheus_username"] if conn else ""
    auth_mode = conn["auth_mode"] if conn else "oauth2_password"
    
    return {
        "id": t.tenant_code,
        "name": t.tenant_name,
        "tenant_code": t.tenant_code,
        "tenant_name": t.tenant_name,
        "protheus_rest_url": rest_url,
        "protheus_webapp_url": t.webapp_url,
        "protheus_user": user,
        "auth_mode": auth_mode,
        "system_prompt": t.system_prompt,
        "temperature": float(t.temperature) if t.temperature is not None else 0.2,
        "status": t.status or "active",
        "plan_code": t.plan_code,
        "cnpj": t.cnpj,
        "licenca_uso": t.licenca_uso,
        "created_at": t.created_at,
        "updated_at": t.updated_at
    }"""
content = re.sub(r'def _to_tenant_dict\(db: Session, t: Tenant\) -> dict:.*?\s+return \{.*?\}', new_to_tenant_dict, content, flags=re.DOTALL)

# 2. Inject helper function _sync_protheus_connection
helper = """
from app.services.protheus_token_service import invalidate_access_token, get_valid_access_token

async def _sync_protheus_connection(db: Session, tenant_code: str, rest_url: str, username: str, password: Optional[str], auth_mode: str):
    if not rest_url:
        return
        
    upsert_sql = text('''
        INSERT INTO public.protheus_rest_connections (
            tenant_code, environment_code, base_rest_url,
            auth_mode, protheus_username, encrypted_protheus_password, active
        ) VALUES (
            :t_code, 'default', :url, :auth, :user, :pw, TRUE
        ) ON CONFLICT (tenant_code, environment_code) DO UPDATE SET
            base_rest_url = EXCLUDED.base_rest_url,
            auth_mode = EXCLUDED.auth_mode,
            protheus_username = EXCLUDED.protheus_username,
            encrypted_protheus_password = COALESCE(EXCLUDED.encrypted_protheus_password, public.protheus_rest_connections.encrypted_protheus_password),
            active = TRUE,
            updated_at = NOW();
    ''')
    
    enc_pw = encrypt_password(password) if password else None
    
    db.execute(upsert_sql, {
        "t_code": tenant_code,
        "url": rest_url.rstrip("/"),
        "auth": auth_mode or "oauth2_password",
        "user": username or "admin",
        "pw": enc_pw
    })
    db.commit()
    
    # Valida credenciais obtendo o token
    try:
        invalidate_access_token(db, tenant_code, "default")
        await get_valid_access_token(db, tenant_code, "default")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao validar Conexão Protheus: {str(e)}")

# ■ Endpoints Protegidos por Admin ■
"""
content = content.replace('# ■ Endpoints Protegidos por Admin ■', helper)

# 3. Modify create_tenant
content = content.replace('def create_tenant(', 'async def create_tenant(')
content = content.replace('tenant.apirest_url = body.protheus_rest_url or tenant.apirest_url\n', '')
content = content.replace('tenant.protheus_user = body.protheus_user or tenant.protheus_user\n', '')
content = content.replace('apirest_url=body.protheus_rest_url,\n', '')
content = content.replace('protheus_user=body.protheus_user,\n', '')
content = content.replace('_apply_password(tenant, body.protheus_password)\n', '')

first_return = '    return _to_tenant_dict(db, tenant)'
content = content.replace(first_return, '''
    if body.protheus_rest_url:
        await _sync_protheus_connection(
            db, clean_tenant, body.protheus_rest_url, 
            body.protheus_user, body.protheus_password, body.auth_mode
        )

    return _to_tenant_dict(db, tenant)''')

# 4. Modify update_tenant
content = content.replace('def update_tenant(', 'async def update_tenant(')
content = content.replace('''    if body.protheus_rest_url is not None:
        tenant.apirest_url = body.protheus_rest_url
    if body.protheus_webapp_url is not None:
        tenant.webapp_url = body.protheus_webapp_url
    if body.protheus_user is not None:
        tenant.protheus_user = body.protheus_user''', '''    if body.protheus_webapp_url is not None:
        tenant.webapp_url = body.protheus_webapp_url''')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
