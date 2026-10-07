import re

with open('backend/app/schemas/company_modules.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """class CompanyListItem(BaseModel):
    id: int"""

replacement = """class CompanyListItem(BaseModel):
    id: str"""

content = content.replace(target, replacement)

with open('backend/app/schemas/company_modules.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Corrigido company_modules.py!")

with open('backend/app/schemas/company.py', 'r', encoding='utf-8') as f:
    content = f.read()

target2 = """class CompanyResponse(CompanyBase):
    \"\"\"Resposta pública - NUNCA retorna encrypted_protheus_password.\"\"\"
    id: int"""

replacement2 = """class CompanyResponse(CompanyBase):
    \"\"\"Resposta pública - NUNCA retorna encrypted_protheus_password.\"\"\"
    id: str"""

content = content.replace(target2, replacement2)

with open('backend/app/schemas/company.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Corrigido company.py!")
