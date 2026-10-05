import re

with open('admin-frontend/src/pages/governance/BusinessRulesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\s*createSynonym,', '', content)
content = re.sub(r'\s*deleteSynonym,', '', content)

with open('admin-frontend/src/pages/governance/BusinessRulesPage.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
