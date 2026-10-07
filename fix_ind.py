import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        try:
        users = db.execute(text("SELECT id FROM public.users")).fetchall()
        for u in users:
            db.execute(text(f\"\"\"
                    INSERT INTO "{clean_tenant}".user_company_access (user_id, company_id, environment_id)
                    VALUES (:uid, :cid, :eid)
                    ON CONFLICT DO NOTHING
                \"\"\"), {"uid": u[0], "cid": company_id, "eid": env_id})
        except Exception as e:
            pass"""

replacement = """        try:
            users = db.execute(text("SELECT id FROM public.users")).fetchall()
            for u in users:
                db.execute(text(f\"\"\"
                    INSERT INTO "{clean_tenant}".user_company_access (user_id, company_id, environment_id)
                    VALUES (:uid, :cid, :eid)
                    ON CONFLICT DO NOTHING
                \"\"\"), {"uid": u[0], "cid": company_id, "eid": env_id})
        except Exception as e:
            pass"""

if target in content:
    content = content.replace(target, replacement)
    with open('backend/app/api/company_routes.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Alvo não encontrado!")
