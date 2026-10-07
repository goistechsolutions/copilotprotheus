import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.startswith("        users = db.execute(text(\"SELECT id FROM public.users")).fetchall()"):
        lines[i] = "            " + line.strip() + "\n"
    elif line.startswith("        for u in users:"):
        lines[i] = "            " + line.strip() + "\n"
    elif line.startswith("            db.execute(text(f\"\"\""):
        if 'user_company_access' in lines[i+1]:
            lines[i] = "                " + line.strip() + "\n"
    elif line.startswith("                    INSERT INTO \"{clean_tenant}\".user_company_access"):
        lines[i] = "                    " + line.strip() + "\n"

# wait, it's safer to just rewrite the block!

