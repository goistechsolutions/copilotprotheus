with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('name="uq_company_info_code_branch"),', 'name="uq_company_info_code_branch"),
        {"extend_existing": True},')
with open('backend/app/models/knowledge.py', 'w', encoding='utf-8') as f:
    f.write(content)

