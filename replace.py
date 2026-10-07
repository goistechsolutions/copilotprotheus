import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        db.execute(text(f\"\"\"
            INSERT INTO "{clean_tenant}".protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
            VALUES (:env_id, :url, 'oauth2_password', :sec, true)
            ON CONFLICT (environment_id) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                secret_ref = EXCLUDED.secret_ref,
                active = true,
                updated_at = NOW()
        \"\"\"), {
            "env_id": env_id,
            "url": payload.protheus_rest_url,
            "sec": json.dumps(sec_data)
        })

        db.commit()"""

replacement = """        db.execute(text(f\"\"\"
            INSERT INTO "{clean_tenant}".protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
            VALUES (:env_id, :url, 'oauth2_password', :sec, true)
            ON CONFLICT (environment_id) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                secret_ref = EXCLUDED.secret_ref,
                active = true,
                updated_at = NOW()
        \"\"\"), {
            "env_id": env_id,
            "url": payload.protheus_rest_url,
            "sec": json.dumps(sec_data)
        })

        users = db.execute(text("SELECT id FROM public.users")).fetchall()
        for u in users:
            db.execute(text(f\"\"\"
                INSERT INTO "{clean_tenant}".user_company_access (user_id, company_id, environment_id)
                VALUES (:uid, :cid, :eid)
                ON CONFLICT DO NOTHING
            \"\"\"), {"uid": u[0], "cid": comp_id, "eid": env_id})

        db.commit()"""

if target in content:
    content = content.replace(target, replacement)
    with open('backend/app/api/company_routes.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Substituido!")
else:
    print("Alvo nao encontrado.")
