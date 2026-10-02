-- 20261002_002_tenant_schema_key_down.sql (manual; runner ignora *_down.sql)
BEGIN;
DROP FUNCTION IF EXISTS public.provision_tenant_by_schema_key(varchar);
ALTER TABLE public.tenant DROP CONSTRAINT IF EXISTS ck_tenant_schema_key_format;
ALTER TABLE public.tenant DROP CONSTRAINT IF EXISTS uq_tenant_schema_key;
ALTER TABLE public.tenant DROP COLUMN IF EXISTS schema_key;
COMMIT;
-- Nao remove nenhum schema fisico.
