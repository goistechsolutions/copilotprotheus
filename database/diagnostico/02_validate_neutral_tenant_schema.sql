-- 02_validate_neutral_tenant_schema.sql
SELECT id, tenant_code, schema_name, schema_key, status
FROM public.tenant ORDER BY id;

SELECT schema_key, count(*)
FROM public.tenant
WHERE schema_key IS NOT NULL
GROUP BY schema_key HAVING count(*) > 1;

SELECT table_schema, count(*) AS tabelas
FROM information_schema.tables
WHERE table_schema = (SELECT schema_key FROM public.tenant WHERE tenant_code='rodol_prd')
GROUP BY table_schema;
