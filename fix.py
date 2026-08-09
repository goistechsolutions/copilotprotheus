import re

with open('backend/app/services/sync_dictionary_v52.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'INSERT INTO dictionary_tables\n                        (tenant_id, company_id, environment_id, snapshot_code,',
    'INSERT INTO dictionary_tables\n                        (tenant_id, company_id, environment_id,'
)
content = content.replace(
    'VALUES (:tenant_id,:company_id,:environment_id,:snapshot_code,',
    'VALUES (:tenant_id,:company_id,:environment_id,'
)
content = content.replace(
    'ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name)',
    'ON CONFLICT (tenant_id, environment_id, table_name)'
)
content = content.replace(
    '"environment_id": str(environment_id), "snapshot_code": snapshot_code,',
    '"environment_id": str(environment_id),'
)

content = content.replace(
    '(tenant_id, company_id, environment_id, snapshot_code,',
    '(tenant_id, company_id, environment_id,'
)

content = content.replace(
    'ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name, field_name)',
    'ON CONFLICT (tenant_id, environment_id, table_name, field_name)'
)
content = content.replace(
    'ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name, index_order)',
    'ON CONFLICT (tenant_id, environment_id, table_name, index_order)'
)
content = content.replace(
    'ON CONFLICT (tenant_id, environment_id, snapshot_code, group_name)',
    'ON CONFLICT (tenant_id, environment_id, group_name)'
)

with open('backend/app/services/sync_dictionary_v52.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
