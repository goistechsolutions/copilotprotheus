import os

search_terms = ["hetzner", "cloudflare", "copilot.elitecorp.tec.br"]
project_root = "C:/projeto/copilotprotheus"

for root, dirs, files in os.walk(project_root):
    # Skip directories like .git, node_modules, venv, etc.
    if any(p in root for p in [".git", "node_modules", "venv", ".pytest_cache"]):
        continue
    for file in files:
        if file.endswith((".py", ".js", ".json", ".yml", ".yaml", ".md", ".sh", ".ps1", ".env", ".example", "Dockerfile")):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read().lower()
                for term in search_terms:
                    if term in content:
                        print(f"Found '{term}' in: {file_path}")
            except Exception:
                pass
