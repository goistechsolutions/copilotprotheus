import re

filepath = r'C:\projeto\copilotprotheus\backend\app\api\company_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the block in create_company
block1 = r'''    if payload.protheus_rest_url and payload.protheus_usuario and enc_pass:
        upsert_conn = text("""
            INSERT INTO public.protheus_rest_connections (
                tenant_code, environment_code, base_rest_url,
                auth_mode, protheus_username, encrypted_protheus_password, active
            ) VALUES (
                :t_code, 'default', :url, 'oauth2_password', :user, :pw, TRUE
            ) ON CONFLICT (tenant_code, environment_code) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                protheus_username = EXCLUDED.protheus_username,
                encrypted_protheus_password = EXCLUDED.encrypted_protheus_password,
                active = TRUE,
                updated_at = NOW();
        """)
        db.execute(upsert_conn, {
            "t_code": clean_tenant,
            "url": payload.protheus_rest_url.rstrip("/"),
            "user": payload.protheus_usuario,
            "pw": enc_pass
        })'''
content = content.replace(block1, '')

# Remove the block in update_company
block2 = r'''    user = payload.protheus_usuario or comp_info.get("protheus_usuario")
    pw = enc_pass or comp_info.get("encrypted_protheus_password")

    if rest_url and user and pw:
        upsert_conn = text("""
            INSERT INTO public.protheus_rest_connections (
                tenant_code, environment_code, base_rest_url,
                auth_mode, protheus_username, encrypted_protheus_password, active
            ) VALUES (
                :t_code, 'default', :url, 'oauth2_password', :user, :pw, TRUE
            ) ON CONFLICT (tenant_code, environment_code) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                protheus_username = EXCLUDED.protheus_username,
                encrypted_protheus_password = EXCLUDED.encrypted_protheus_password,
                active = TRUE,
                updated_at = NOW();
        """)
        db.execute(upsert_conn, {
            "t_code": clean_tenant,
            "url": rest_url.rstrip("/"),
            "user": user,
            "pw": pw
        })'''
content = content.replace(block2, '')

# Also let's clean up any unused variables from payload
content = re.sub(r'    enc_pass = None\n    if payload.protheus_password:\n        enc_pass = encrypt_password\(payload.protheus_password\)\n\n', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Cleaned company_routes.py')
