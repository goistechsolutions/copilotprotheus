import sys
with open("C:/projeto/copilotprotheus/frontend/src/AssistantWidget.jsx", "r", encoding="utf-8") as f:
    content = f.read()
idx = content.find("return (")
if idx != -1:
    sys.stdout.buffer.write(content[idx:idx+3500].encode('utf-8'))
