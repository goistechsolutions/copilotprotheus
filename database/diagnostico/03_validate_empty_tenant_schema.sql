-- 03_validate_empty_tenant_schema.sql
SELECT id, tenant_code, schema_name, schema_key, status, provisioned_at
FROM public.tenant ORDER BY id;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = (SELECT schema_key FROM public.tenant WHERE tenant_code='rodol_prd')
ORDER BY table_name;

SELECT format('SELECT %L AS tabela, count(*) AS registros FROM %I.%I;',
              table_name, table_schema, table_name)
FROM information_schema.tables
WHERE table_schema = (SELECT schema_key FROM public.tenant WHERE tenant_code='rodol_prd')
ORDER BY table_name;
