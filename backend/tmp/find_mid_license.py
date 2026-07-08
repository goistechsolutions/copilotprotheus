import os
for root, dirs, files in os.walk("C:/projeto/copilotprotheus/middleware/src"):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "license" in content:
                    print(f"File: {path}")
