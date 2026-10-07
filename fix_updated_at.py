import re

with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = "updated_at = Column(TIMESTAMP(timezone=True))"
replacement = "updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())"

if target in content:
    content = content.replace(target, replacement)
    with open('backend/app/models/knowledge.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("Corrigido knowledge.py!")
else:
    print("Alvo não encontrado.")
