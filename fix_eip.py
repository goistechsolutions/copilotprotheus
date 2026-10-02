import re

with open('database/migrations/20260927_eip_3_0_migrations.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

sql = sql.replace('DO \nBEGIN', 'DO $$\nBEGIN')
sql = sql.replace('END ;', 'END $$;')

with open('database/migrations/20260927_eip_3_0_migrations.sql', 'w', encoding='utf-8', newline='\n') as f:
    f.write(sql)

print('Fixed $$ in 20260927_eip_3_0_migrations.sql')
