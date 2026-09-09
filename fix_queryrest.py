import re
path = 'backend/app/services/queryrest_service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''        logger.error(
            "[QueryRest Tenant] Falha tenant=%s ambiente=%s status=%s",
            tenant_id,
            environment_code,
            e.status_code,
        )''',
    '''        logger.error(
            "[QueryRest Tenant] Falha tenant=%s ambiente=%s status=%s body=%s",
            tenant_id,
            environment_code,
            e.status_code,
            e.response_body,
        )'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
