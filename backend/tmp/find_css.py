with open("C:/projeto/copilotprotheus/frontend/src/styles.css", "r", encoding="utf-8") as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if "assistant-launcher" in line:
        print(f"Line {idx+1}: {line.strip()}")
