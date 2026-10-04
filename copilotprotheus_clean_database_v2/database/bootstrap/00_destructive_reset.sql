-- IRREVERSÍVEL: remove toda a estrutura existente desta base.
-- Requer confirmação explícita na MESMA sessão:
-- SET copilot.allow_destructive_reset = 'RESET-COPILOT-PROTHEUS';

DO $guard$
BEGIN
  IF current_setting('copilot.allow_destructive_reset', true)
       IS DISTINCT FROM 'RESET-COPILOT-PROTHEUS' THEN
    RAISE EXCEPTION
      'Reset bloqueado. Defina copilot.allow_destructive_reset na mesma sessão.';
  END IF;
END
$guard$;

-- Remove schemas de tenant conhecidos antes de remover public.
DO $drop_tenants$
DECLARE r record;
BEGIN
  IF to_regclass('public.tenant') IS NOT NULL THEN
    FOR r IN EXECUTE
      'SELECT DISTINCT schema_name FROM public.tenant WHERE schema_name IS NOT NULL'
    LOOP
      IF r.schema_name ~ '^[a-z][a-z0-9_]{2,62}$'
         AND r.schema_name NOT IN ('public','information_schema','pg_catalog')
         AND r.schema_name NOT LIKE 'pg_%' THEN
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.schema_name);
      END IF;
    END LOOP;
  ELSIF to_regclass('public.tenants') IS NOT NULL THEN
    FOR r IN EXECUTE
      'SELECT DISTINCT schema_name FROM public.tenants WHERE schema_name IS NOT NULL'
    LOOP
      IF r.schema_name ~ '^[a-z][a-z0-9_]{2,62}$'
         AND r.schema_name NOT IN ('public','information_schema','pg_catalog')
         AND r.schema_name NOT LIKE 'pg_%' THEN
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.schema_name);
      END IF;
    END LOOP;
  END IF;
END
$drop_tenants$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;
COMMENT ON SCHEMA public IS 'Copilot Protheus control plane; sem dados conversacionais de tenant.';

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
