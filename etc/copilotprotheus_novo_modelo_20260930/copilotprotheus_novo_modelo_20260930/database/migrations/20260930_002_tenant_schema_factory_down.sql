-- Copilot Protheus
-- Migration 20260930_002 DOWN
-- Não remove schemas nem dados de tenants.
BEGIN;
DROP FUNCTION IF EXISTS public.provision_tenant_schema(varchar);
COMMIT;
