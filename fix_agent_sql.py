import re

with open('backend/app/api/agent_sql_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove get_latest_snapshot_code import
content = re.sub(r'\s*get_latest_snapshot_code,', '', content)

# Remove the get_latest_snapshot_code call and check
pattern_snapshot_check = r'# 2\. Localizar cdigo do ltimo snapshot.*?(?:raise HTTPException.*?\)|\n\s*\n\s+db=db,)'
# Actually, let's just do standard string replacements:

with open('backend/app/api/agent_sql_routes.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "get_latest_snapshot_code," in line:
        continue
    if "get_latest_snapshot_code(" in line:
        skip = True
        continue
    if skip and "raise HTTPException(" in line:
        continue
    if skip and "detail=" in line:
        continue
    if skip and "tenant:" in line:
        continue
    if skip and "        )" in line:
        skip = False
        continue
    if "snapshot_code=snapshot_code" in line:
        continue
    if '"snapshot_code": snapshot_code,' in line:
        continue
    new_lines.append(line)

with open('backend/app/api/agent_sql_routes.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("agent_sql_routes patched")
