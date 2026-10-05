import os
import re

def fix_protheus_token_service():
    path = 'backend/app/services/protheus_token_service.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to rewrite load_connection, _update_tokens_in_db, invalidate_access_token
    # Since it's big, we'll replace the bodies of the functions explicitly.
    
    # 1. load_connection
    load_conn = '''
def load_connection(
    db: Any,
    tenant_code: str,
    environment_code: str,
) -> dict[str, Any]:
    import json
    from app.db.database import resolve_clean_tenant
    environment_code = _require_real_environment(environment_code)
    clean_tenant = resolve_clean_tenant(tenant_code)
    try:
        row = db.execute(
            text(f"""
                SELECT
                    c.id,
                    e.environment_code,
                    c.base_rest_url,
                    c.auth_mode,
                    c.secret_ref,
                    c.active
                FROM "{clean_tenant}".protheus_connections c
                JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
                WHERE e.environment_code = :environment_code
                  AND c.active = TRUE
                LIMIT 1
            """),
            {
                "environment_code": environment_code,
            },
        ).mappings().first()
    except Exception as e:
        raise ValueError(f"Erro ao buscar conexo para {clean_tenant}/{environment_code}: {e}")

    if not row:
        raise ValueError(
            f"conexo REST Protheus ativa no localizada para {tenant_code}/{environment_code}"
        )
        
    sec_data = {}
    if row["secret_ref"]:
        try:
            sec_data = json.loads(row["secret_ref"])
        except:
            pass

    conn_dict = dict(row)
    conn_dict["tenant_code"] = tenant_code
    conn_dict["protheus_username"] = sec_data.get("protheus_username")
    conn_dict["encrypted_protheus_password"] = sec_data.get("encrypted_protheus_password")
    conn_dict["encrypted_access_token"] = sec_data.get("encrypted_access_token")
    conn_dict["encrypted_refresh_token"] = sec_data.get("encrypted_refresh_token")
    conn_dict["access_token_expires_at"] = sec_data.get("access_token_expires_at")
    conn_dict["token_updated_at"] = sec_data.get("token_updated_at")

    # The access_token_expires_at comes back as a string from JSON, we need datetime
    if conn_dict["access_token_expires_at"] and isinstance(conn_dict["access_token_expires_at"], str):
        from dateutil.parser import isoparse
        try:
            conn_dict["access_token_expires_at"] = isoparse(conn_dict["access_token_expires_at"])
        except:
            pass
            
    return _row_to_connection(conn_dict)
'''

    content = re.sub(
        r'def load_connection\([\s\S]*?return _row_to_connection\(row\)',
        load_conn.strip(),
        content
    )

    # 2. _update_tokens_in_db
    update_tokens = '''
def _update_tokens_in_db(
    db: Any,
    connection: Mapping[str, Any],
    new_token: ProtheusToken,
) -> None:
    import json
    from app.db.database import resolve_clean_tenant
    tenant_code = connection["tenant_code"]
    clean_tenant = resolve_clean_tenant(tenant_code)
    
    encrypted_access = _encrypt_secret(new_token.access_token)
    encrypted_refresh_val = (
        _encrypt_secret(new_token.refresh_token)
        if new_token.refresh_token
        else connection.get("encrypted_refresh_token")
    )
    
    # Busca secret_ref atual
    row = db.execute(
        text(f"SELECT secret_ref FROM \\"{clean_tenant}\\".protheus_connections WHERE id = :id"),
        {"id": connection["id"]}
    ).mappings().first()
    
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
    db.commit()
'''
    content = re.sub(
        r'def _update_tokens_in_db\([\s\S]*?db\.commit\(\)',
        update_tokens.strip(),
        content
    )

    # 3. invalidate_access_token
    invalidate = '''
def invalidate_access_token(
    db: Any,
    tenant_code: str,
    environment_code: str,
) -> None:
    import json
    from app.db.database import resolve_clean_tenant
    environment_code = _require_real_environment(environment_code)
    clean_tenant = resolve_clean_tenant(tenant_code)
    
    try:
        row = db.execute(
            text(f"""
                SELECT c.id, c.secret_ref 
                FROM "{clean_tenant}".protheus_connections c
                JOIN "{clean_tenant}".environments e ON e.id = c.environment_id
                WHERE e.environment_code = :environment_code
            """),
            {"environment_code": environment_code}
        ).mappings().first()
        
        if not row:
            return
            
        sec_data = {}
        if row["secret_ref"]:
            try:
                sec_data = json.loads(row["secret_ref"])
            except:
                pass
                
        sec_data["encrypted_access_token"] = None
        sec_data["access_token_expires_at"] = None
        sec_data["token_updated_at"] = None
        
        db.execute(
            text(f"""
                UPDATE "{clean_tenant}".protheus_connections
                SET secret_ref = :secret_ref,
                    last_auth_error = 'access token invalidado após HTTP 401',
                    last_auth_status = 401,
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                "id": row["id"],
                "secret_ref": json.dumps(sec_data)
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
'''
    content = re.sub(
        r'def invalidate_access_token\([\s\S]*?db\.commit\(\)',
        invalidate.strip(),
        content
    )

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_protheus_token_service()
