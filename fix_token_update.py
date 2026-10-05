import os
import re

def fix_protheus_token_update():
    path = 'backend/app/services/protheus_token_service.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_update = '''
        db.execute(
            text("""
                UPDATE public.protheus_rest_connections
                SET encrypted_access_token = :access_token,
                    encrypted_refresh_token = :refresh_token,
                    access_token_expires_at = :expires_at,
                    token_updated_at = NOW(),
                    last_auth_error = NULL,
                    last_auth_status = NULL,
                    last_success_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": connection["id"],
                "access_token": encrypted_access,
                "refresh_token": encrypted_refresh_val,
                "expires_at": new_token.expires_at,
            },
        )
'''

    new_update = '''
        # Busca secret_ref atual
        from app.db.database import resolve_clean_tenant
        clean_tenant = resolve_clean_tenant(db, connection["tenant_code"])
        row = db.execute(
            text(f"SELECT secret_ref FROM \\"{clean_tenant}\\".protheus_connections WHERE id = :id"),
            {"id": connection["id"]}
        ).mappings().first()
        
        import json
        sec_data = {}
        if row and row["secret_ref"]:
            try:
                sec_data = json.loads(row["secret_ref"])
            except:
                pass
                
        sec_data["encrypted_access_token"] = encrypted_access
        sec_data["encrypted_refresh_token"] = encrypted_refresh_val
        sec_data["access_token_expires_at"] = new_token.expires_at.isoformat() if new_token.expires_at else None
        sec_data["token_updated_at"] = _utcnow().isoformat()
        
        db.execute(
            text(f"""
                UPDATE "{clean_tenant}".protheus_connections
                SET secret_ref = :secret_ref,
                    last_auth_error = NULL,
                    last_auth_status = NULL,
                    last_success_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": connection["id"],
                "secret_ref": json.dumps(sec_data)
            },
        )
'''

    content = content.replace(old_update.strip(), new_update.strip())

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_protheus_token_update()
