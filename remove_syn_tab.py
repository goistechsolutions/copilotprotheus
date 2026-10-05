import re

with open('admin-frontend/src/pages/governance/BusinessRulesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the sinonimos tab button
content = re.sub(
    r"\{\s*id:\s*'sinonimos'.*?\},",
    "",
    content,
    flags=re.DOTALL
)

# Replace the synonyms tab UI
idx1 = content.find("{activeTab === 'sinonimos' && (")
if idx1 != -1:
    idx2 = content.find("{activeTab === 'auditoria' && (", idx1)
    if idx2 == -1:
        idx2 = content.find("</main>", idx1)
    content = content[:idx1] + content[idx2:]

# Replace the synonym modal
idx3 = content.find("{/* Modal: Sin")
if idx3 != -1:
    idx4 = content.find("</div>\n    </div>\n  );\n}", idx3)
    if idx4 != -1:
        content = content[:idx3] + content[idx4:]

with open('admin-frontend/src/pages/governance/BusinessRulesPage.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Removed Synonyms from BusinessRulesPage")
