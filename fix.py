import sys

def patch(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for i, line in enumerate(lines):
        if 'for sql_file in database/migrations/*.sql; do' in line:
            if 'continue' not in lines[i+2]:
                lines.insert(i+2, '              if [[ "$sql_file" == *_down.sql ]]; then\n                echo "Ignorando migration down: $sql_file"\n                continue\n              fi\n')
                break

    with open(filename, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)

patch('.github/workflows/deploy-backend.yml')
patch('.github/workflows/deploy-with-migrations.yml')
print('Done!')
