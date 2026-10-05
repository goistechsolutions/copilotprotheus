import re

with open('backend/app/models/business_knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'    field_description = Column\(Text\)\n',
    '    field_description = Column(Text)\n    synonyms = Column(String(500))\n',
    content
)

with open('backend/app/models/business_knowledge.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
