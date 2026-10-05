import re
paths = ['database/bootstrap/02_tenant_schema_factory.sql', 'database/migrations/02_tenant_schema_factory.sql']
for filepath in paths:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        content = re.sub(r'embedding vector,', 'embedding public.vector,', content)
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(e)
