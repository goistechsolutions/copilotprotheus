import re

def make_idempotent(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('CREATE TABLE %I', 'CREATE TABLE IF NOT EXISTS %I')
    content = content.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ')
    # Don't replace CREATE UNIQUE INDEX IF NOT EXISTS because it might fail if IF NOT EXISTS is already there. Let's just use regex.
    content = re.sub(r'CREATE (UNIQUE )?INDEX(?! IF NOT EXISTS) ', r'CREATE \1INDEX IF NOT EXISTS ', content)
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

make_idempotent('database/bootstrap/02_tenant_schema_factory.sql')
make_idempotent('database/migrations/02_tenant_schema_factory.sql')
