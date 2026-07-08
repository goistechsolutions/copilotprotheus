import os
for root, dirs, files in os.walk("C:/projeto/copilotprotheus"):
    if ".git" in root or "venv" in root or "node_modules" in root:
        continue
    for file in files:
        if file.endswith((".py", ".js", ".prw", ".jsx")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "pilot_rodolltda" in content:
                    print(f"File: {path}")
