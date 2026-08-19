import re

filepath = r'C:\projeto\copilotprotheus\backend\app\api\tenant_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

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

"""

# Insert right before find_tenant_by_id_or_code
content = content.replace("def find_tenant_by_id_or_code(", helper + "\ndef find_tenant_by_id_or_code(")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
