filepath = r'C:\projeto\copilotprotheus\backend\app\api\company_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace pass: enc_pass with pass: None
content = content.replace('"pass": enc_pass,', '"pass": None,')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
