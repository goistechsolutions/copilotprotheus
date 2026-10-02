-- 20261002_002_tenant_schema_key_up.sql
-- Cria um identificador tecnico neutro para o schema fisico do tenant.
-- O schema_name atual pode conter o nome de uma empresa/ambiente legado (ex.: rodol_prd)
-- e nao deve ser reutilizado como identificador canonico do novo modelo.
BEGIN;

ALTER TABLE public.tenant
  ADD COLUMN IF NOT EXISTS schema_key varchar(63);

UPDATE public.tenant
   SET schema_key = CASE
      WHEN id IS NOT NULL THEN 'tenant_' || id::text
      ELSE NULL
   END
 WHERE schema_key IS NULL
   AND id IS NOT NULL
   AND ('tenant_' || id::text) ~ '^[a-z][a-z0-9_]{2,62}$';

ALTER TABLE public.tenant
  ADD CONSTRAINT uq_tenant_schema_key UNIQUE (schema_key);

ALTER TABLE public.tenant
  ADD CONSTRAINT ck_tenant_schema_key_format
  CHECK (schema_key IS NULL OR schema_key ~ '^[a-z][a-z0-9_]{2,62}$');

COMMENT ON COLUMN public.tenant.schema_name IS
'Legado/compatibilidade. Pode representar schema de empresa/ambiente; nao usar como identificador canonico do novo modelo.';
COMMENT ON COLUMN public.tenant.schema_key IS
'Identificador tecnico canonico e neutro do schema fisico do tenant. Ex.: tenant_1.';

CREATE OR REPLACE FUNCTION public.provision_tenant_by_schema_key(p_tenant_code varchar)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_schema text;
BEGIN
  SELECT schema_key INTO v_schema
  FROM public.tenant
  WHERE tenant_code = p_tenant_code
    AND status IS DISTINCT FROM 'DECOMMISSIONED'
  FOR UPDATE;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Tenant ativo sem schema_key: %', p_tenant_code;
  END IF;

  IF v_schema IN ('public','pg_catalog','information_schema') OR v_schema LIKE 'pg_%'
     OR v_schema !~ '^[a-z][a-z0-9_]{2,62}$' THEN
    RAISE EXCEPTION 'schema_key invalido: %', v_schema;
  END IF;

  -- A factory original resolve public.tenant.schema_name.
  -- Mantemos o legado e alteramos apenas durante esta transacao.
  UPDATE public.tenant
     SET schema_name = v_schema
   WHERE tenant_code = p_tenant_code;

  PERFORM public.provision_tenant_schema(p_tenant_code);

  UPDATE public.tenant
     SET schema_name = 'rodol_prd'
   WHERE tenant_code = p_tenant_code
     AND schema_name = v_schema;

  RETURN v_schema;
END
$fn$;

REVOKE ALL ON FUNCTION public.provision_tenant_by_schema_key(varchar) FROM PUBLIC;
COMMENT ON FUNCTION public.provision_tenant_by_schema_key(varchar) IS
'Provisiona estrutura vazia no schema tecnico do tenant; nao usa nome de empresa como chave canonica.';

COMMIT;
