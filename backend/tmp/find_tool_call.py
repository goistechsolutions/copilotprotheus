with open("C:/projeto/copilotprotheus/backend/app/services/gemini_client.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if "execute_protheus_tool" in line or "consultar_protheus" in line:
        print(f"Line {idx+1}: {line.strip()}")
