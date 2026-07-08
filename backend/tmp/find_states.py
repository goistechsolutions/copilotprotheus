with open("C:/projeto/copilotprotheus/frontend/src/AssistantWidget.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if "const [open" in line or "const [minimized" in line or "const [maximized" in line:
        print(f"Line {idx+1}: {line.strip()}")
