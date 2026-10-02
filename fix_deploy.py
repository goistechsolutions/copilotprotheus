
with open('.github/workflows/deploy-backend.yml', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            SQL_COUNT=0
            for sql_file in database/migrations/*.sql; do
              [ -f \"\" ] || { echo \"🔄 Nenhum arquivo SQL encontrado em database/migrations/\"; break; }'''
target = target.replace('\', '')

replacement = '''            SQL_COUNT=0
            for sql_file in database/migrations/*.sql; do
              [ -f \"\" ] || { echo \"🔄 Nenhum arquivo SQL encontrado em database/migrations/\"; break; }
              if [[ \"\" == *_down.sql ]]; then
                echo \"→ Ignorando  (migration down)\"
                continue
              fi'''
replacement = replacement.replace('\', '')

new_content = content.replace(target, replacement)
if new_content != content:
    with open('.github/workflows/deploy-backend.yml', 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content)
    print('Updated deploy-backend.yml successfully')
else:
    print('Target not found in deploy-backend.yml')

with open('.github/workflows/deploy-with-migrations.yml', 'r', encoding='utf-8') as f:
    content2 = f.read()

new_content2 = content2.replace(target, replacement)
if new_content2 != content2:
    with open('.github/workflows/deploy-with-migrations.yml', 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content2)
    print('Updated deploy-with-migrations.yml successfully')

