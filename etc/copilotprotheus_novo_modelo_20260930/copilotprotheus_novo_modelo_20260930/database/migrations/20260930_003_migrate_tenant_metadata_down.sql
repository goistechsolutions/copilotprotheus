-- Copilot Protheus
-- Migration 20260930_003 DOWN
-- Remove somente a função; dados copiados não são apagados automaticamente.
BEGIN;
DROP FUNCTION IF EXISTS public.migrate_legacy_tenant_metadata(varchar, varchar);
COMMIT;
