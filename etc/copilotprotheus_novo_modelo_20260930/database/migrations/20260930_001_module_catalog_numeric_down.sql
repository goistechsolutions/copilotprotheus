-- Copilot Protheus
-- Migration 20260930_001 DOWN
-- Rollback permitido somente enquanto a tabela legado UUID estiver preservada.

BEGIN;

LOCK TABLE public.protheus_modules_master IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.tenant_module_contracts IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
    IF to_regclass('public.protheus_modules_master_legacy_uuid') IS NULL THEN
        RAISE EXCEPTION 'Rollback impossível: tabela protheus_modules_master_legacy_uuid não existe';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.protheus_modules_master current_pm
          LEFT JOIN public.protheus_modules_master_legacy_uuid legacy_pm
            ON legacy_pm.mod_code = current_pm.id
         WHERE legacy_pm.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Rollback abortado: existem módulos novos sem UUID legado';
    END IF;
END
$guard$;

DROP VIEW IF EXISTS public.protheus_modules_legacy_compat;
ALTER TABLE public.tenant_module_contracts
    DROP CONSTRAINT IF EXISTS fk_tenant_module_contracts_module;

ALTER TABLE public.tenant_module_contracts
    ADD COLUMN module_id_uuid uuid;

UPDATE public.tenant_module_contracts tmc
   SET module_id_uuid = legacy_pm.id
  FROM public.protheus_modules_master_legacy_uuid legacy_pm
 WHERE legacy_pm.mod_code = tmc.module_id;

ALTER TABLE public.tenant_module_contracts
    ALTER COLUMN module_id_uuid SET NOT NULL;
ALTER TABLE public.tenant_module_contracts DROP COLUMN module_id;
ALTER TABLE public.tenant_module_contracts RENAME COLUMN module_id_uuid TO module_id;

ALTER TABLE public.protheus_modules_master
    RENAME TO protheus_modules_master_numeric_rollback;
ALTER TABLE public.protheus_modules_master_legacy_uuid
    RENAME TO protheus_modules_master;

ALTER TABLE public.tenant_module_contracts
    ADD CONSTRAINT fk_tenant_module_contracts_module
    FOREIGN KEY (module_id)
    REFERENCES public.protheus_modules_master(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;
