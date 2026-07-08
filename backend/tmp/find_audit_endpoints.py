import os

project_root = "C:/projeto/copilotprotheus/backend"
for root, dirs, files in os.walk(project_root):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "audit" in content.lower() or "auditoria" in content.lower():
                    print(f"Audit found in: {path}")
            except Exception:
                pass
