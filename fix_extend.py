with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('__table_args__ = {"schema": "public"}', '__table_args__ = {"schema": "public", "extend_existing": True}')
with open('backend/app/models/knowledge.py', 'w', encoding='utf-8') as f:
    f.write(content)

