import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

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

        try:
            users = db.execute(text("SELECT id FROM public.users")).fetchall()
            for u in users:
                db.execute(text(f\"\"\"
                    INSERT INTO "{clean_tenant}".user_company_access (user_id, company_id, environment_id)
                    VALUES (:uid, :cid, :eid)
                    ON CONFLICT DO NOTHING
                \"\"\"), {"uid": u[0], "cid": company_id, "eid": env_id})
        except Exception as e:
            pass

        db.commit()"""

# Substitute the original logic block
content = re.sub(r'db\.execute\(text\(f\"\"\"\s*INSERT INTO "\{clean_tenant\}"\.protheus_connections.*?\}\)\s*db\.commit\(\)', replacement, content, flags=re.DOTALL)

with open('backend/app/api/company_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Regex replace feito!")
