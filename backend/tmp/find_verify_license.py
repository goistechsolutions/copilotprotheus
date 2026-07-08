import os

project_root = "C:/projeto/copilotprotheus/backend/app"
for root, dirs, files in os.walk(project_root):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "def verify_license" in content or "verify_license =" in content or "verify_license" in content:
                    print(f"verify_license in: {path}")
            except Exception:
                pass
