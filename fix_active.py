import re

path = 'backend/app/db/database.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("status = 'active'", "UPPER(status) = 'ACTIVE'")

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
