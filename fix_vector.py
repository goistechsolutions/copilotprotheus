import re
import glob

for filepath in glob.glob('database/**/*02_tenant_schema_factory.sql', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'embedding vector,', 'embedding public.vector,', content)
    with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
