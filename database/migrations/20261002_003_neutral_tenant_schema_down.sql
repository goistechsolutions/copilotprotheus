-- 20261002_003_neutral_tenant_schema_down.sql (manual; runner ignora *_down.sql)
BEGIN;
DROP FUNCTION IF EXISTS public.provision_empty_tenant_schema(varchar);
DROP INDEX IF EXISTS public.uq_tenant_schema_key;
-- Nao remove schema_key nem schemas fisicos automaticamente.
COMMIT;
