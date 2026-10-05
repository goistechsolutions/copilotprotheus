import re

with open('backend/app/db/database.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_ensure_public = False
in_ensure_tenant = False
in_run_public_ddl = False

for line in lines:
    if line.startswith('def _run_public_ddl'):
        in_run_public_ddl = True
        new_lines.append(line)
        new_lines.append("    pass\n")
        continue
    elif in_run_public_ddl:
        if line.startswith('def '):
            in_run_public_ddl = False
        else:
            continue

    if line.startswith('def ensure_public_tables'):
        in_ensure_public = True
        new_lines.append(line)
        new_lines.append('    global PUBLIC_BOOTSTRAP_DONE\n')
        new_lines.append('    PUBLIC_BOOTSTRAP_DONE = True\n')
        new_lines.append('    return\n')
        continue
    elif in_ensure_public:
        if line.startswith('def '):
            in_ensure_public = False
        else:
            continue

    if line.startswith('def ensure_tenant_tables'):
        in_ensure_tenant = True
        new_lines.append(line)
        new_lines.append('    return\n')
        continue
    elif in_ensure_tenant:
        if line.startswith('def '):
            in_ensure_tenant = False
        else:
            continue

    new_lines.append(line)

with open('backend/app/db/database.py', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(new_lines)

print("Rewrote ensure_public_tables, ensure_tenant_tables and _run_public_ddl to be no-ops.")
