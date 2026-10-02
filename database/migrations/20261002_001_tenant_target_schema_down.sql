-- 20261002_001_tenant_target_schema_down.sql  (executar manualmente; o runner ignora *_down.sql)
BEGIN;
DROP FUNCTION IF EXISTS public.migrate_tenant_to_target_schema(varchar);
DROP FUNCTION IF EXISTS public.provision_tenant_target_schema(varchar);
ALTER TABLE public.tenant DROP COLUMN IF EXISTS target_schema_name;
COMMIT;
-- O schema de destino (ex.: tenant_rodol_prd) NAO e removido aqui. Para descartar em ambiente de teste:
-- DROP SCHEMA tenant_rodol_prd CASCADE;
