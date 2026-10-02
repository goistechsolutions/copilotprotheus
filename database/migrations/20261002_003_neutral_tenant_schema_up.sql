-- 20261002_003_neutral_tenant_schema_up.sql
-- Cria/provisiona estrutura vazia usando schema_key neutro (tenant_<public.tenant.id>).
-- Nao copia dados de schemas legados e nao usa nome de empresa/ambiente como chave.
BEGIN;

ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS schema_key varchar(63);

UPDATE public.tenant
SET schema_key = 'tenant_' || id::text
WHERE schema_key IS NULL
  AND id IS NOT NULL;

DO $validate$
DECLARE v_invalid integer;
BEGIN
  SELECT count(*) INTO v_invalid
  FROM public.tenant
  WHERE schema_key IS NULL
     OR schema_key !~ '^[a-z][a-z0-9_]{2,62}$'
     OR schema_key IN ('public','pg_catalog','information_schema')
     OR schema_key LIKE 'pg_%';
  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'schema_key invalido/ausente em % tenant(s)', v_invalid;
  END IF;
END
$validate$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_schema_key
ON public.tenant(schema_key);

COMMENT ON COLUMN public.tenant.schema_key IS
'Nome tecnico neutro do schema fisico do tenant. Formato tenant_<public.tenant.id>. Nao representa empresa ou ambiente.';
COMMENT ON COLUMN public.tenant.schema_name IS
'Campo legado/compatibilidade. Nao usar para definir o schema fisico canonico do tenant.';

CREATE OR REPLACE FUNCTION public.provision_empty_tenant_schema(p_tenant_code varchar)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_original_schema text;
  v_target_schema text;
  v_result text;
BEGIN
  SELECT schema_name, schema_key
    INTO v_original_schema, v_target_schema
  FROM public.tenant
  WHERE tenant_code = p_tenant_code
    AND status IS DISTINCT FROM 'DECOMMISSIONED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant ativo inexistente: %', p_tenant_code;
  END IF;
  IF v_target_schema IS NULL THEN
    RAISE EXCEPTION 'schema_key ausente para tenant: %', p_tenant_code;
  END IF;

  -- A factory legada resolve public.tenant.schema_name.
  -- A troca e restaurada na mesma transacao; nenhum dado legado e copiado.
  UPDATE public.tenant
     SET schema_name = v_target_schema
   WHERE tenant_code = p_tenant_code;

  v_result := public.provision_tenant_schema(p_tenant_code);

  UPDATE public.tenant
     SET schema_name = v_original_schema,
         provisioned_at = coalesce(provisioned_at, now()),
         updated_at = now()
   WHERE tenant_code = p_tenant_code;

  RETURN v_target_schema;
END
$fn$;

REVOKE ALL ON FUNCTION public.provision_empty_tenant_schema(varchar) FROM PUBLIC;
COMMENT ON FUNCTION public.provision_empty_tenant_schema(varchar) IS
'Cria somente a estrutura vazia do tenant em schema_key. Nao migra dados do schema legado.';

COMMIT;
