-- 20261002_001_tenant_target_schema_up.sql
-- Problema: public.tenant.schema_name = 'rodol_prd' e o MESMO schema legado compartilhado.
-- provision_tenant_schema() usaria CREATE ... IF NOT EXISTS sobre tabelas legadas ja existentes
-- (estrutura diferente) e migrate_legacy_tenant_metadata() recusa origem = destino.
-- Solucao: schema de destino separado (target_schema_name), sem alterar schema_name que o backend atual usa.
BEGIN;

ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS target_schema_name varchar(63);

UPDATE public.tenant
   SET target_schema_name = 'tenant_' || tenant_code
 WHERE target_schema_name IS NULL
   AND ('tenant_' || tenant_code) ~ '^[a-z][a-z0-9_]{2,62}$';

CREATE OR REPLACE FUNCTION public.provision_tenant_target_schema(p_tenant_code varchar)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_orig   text;
  v_target text;
  v_result text;
BEGIN
  SELECT schema_name, target_schema_name INTO v_orig, v_target
    FROM public.tenant
   WHERE tenant_code = p_tenant_code
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant inexistente: %', p_tenant_code;
  END IF;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'target_schema_name nao configurado para %', p_tenant_code;
  END IF;
  IF v_target IS NOT DISTINCT FROM v_orig THEN
    RAISE EXCEPTION 'target_schema_name (%) igual ao schema legado', v_target;
  END IF;

  UPDATE public.tenant SET schema_name = v_target WHERE tenant_code = p_tenant_code;
  v_result := public.provision_tenant_schema(p_tenant_code);
  UPDATE public.tenant SET schema_name = v_orig WHERE tenant_code = p_tenant_code;
  RETURN v_result;
END
$fn$;

CREATE OR REPLACE FUNCTION public.migrate_tenant_to_target_schema(p_tenant_code varchar)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_orig   text;
  v_target text;
BEGIN
  SELECT schema_name, target_schema_name INTO v_orig, v_target
    FROM public.tenant
   WHERE tenant_code = p_tenant_code
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant inexistente: %', p_tenant_code;
  END IF;
  IF v_target IS NULL OR v_orig IS NULL THEN
    RAISE EXCEPTION 'schema_name/target_schema_name nao configurado para %', p_tenant_code;
  END IF;
  IF v_target = v_orig THEN
    RAISE EXCEPTION 'target_schema_name (%) igual ao schema legado', v_target;
  END IF;

  UPDATE public.tenant SET schema_name = v_target WHERE tenant_code = p_tenant_code;
  PERFORM public.migrate_legacy_tenant_metadata(p_tenant_code, v_orig);
  UPDATE public.tenant SET schema_name = v_orig WHERE tenant_code = p_tenant_code;
  RETURN v_target;
END
$fn$;

REVOKE ALL ON FUNCTION public.provision_tenant_target_schema(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_tenant_to_target_schema(varchar) FROM PUBLIC;

COMMIT;
