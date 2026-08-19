import re

with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\n    snapshot_code = Column\(String\(60\), nullable=False\)', '', content)

with open('backend/app/models/knowledge.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
