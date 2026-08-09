import re
with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find classes with just __tablename__ and NO __table_args__
content = re.sub(
    r'(__tablename__ = ".*?")\n(?!\s*__table_args__)',
    r'\1\n    __table_args__ = {"extend_existing": True}\n',
    content
)

with open('backend/app/models/knowledge.py', 'w', encoding='utf-8') as f:
    f.write(content)

