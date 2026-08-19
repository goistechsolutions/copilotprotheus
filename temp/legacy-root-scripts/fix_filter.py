import re

with open("backend/app/services/protheus_service.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "DictionaryTable.tenant_id == tid.active_flag == True,",
    "DictionaryTable.tenant_id == tid,\n            DictionaryTable.active_flag == True,"
)

with open("backend/app/services/protheus_service.py", "w", encoding="utf-8") as f:
    f.write(content)
