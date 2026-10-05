import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the try-except block that queries public.tenant for frontend_domain
content = re.sub(
    r'# Inicializa banco rapidamente.*?except Exception as e:\n    logger\.warning.*?\{e\}"\)\n',
    '',
    content,
    flags=re.DOTALL
)

with open('backend/app/main.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Removed CORS frontend_domain query from main.py")
