-- 20260819_module_catalog.sql
-- Catálogo global de módulos Protheus (fonte: SYS_USR_MODULE).
-- Esta tabela é GLOBAL e NÃO contém dados de tenant/empresa. 

BEGIN;

-- Tabela de referência de módulos
CREATE TABLE IF NOT EXISTS public.protheus_modules_master ( 
    mod_code INTEGER PRIMARY KEY,
    mod_sigla VARCHAR(60) NOT NULL,
    mod_name VARCHAR(160),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice único por sigla normalizada (SIGAFAT, SIGAFIN, etc.) 
CREATE UNIQUE INDEX IF NOT EXISTS uq_protheus_modules_master_sigla
    ON public.protheus_modules_master (UPPER(TRIM(mod_sigla)));

-- Índice por status
CREATE INDEX IF NOT EXISTS ix_protheus_modules_master_active
    ON public.protheus_modules_master (active);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_protheus_modules_master() 
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$ 
BEGIN
    NEW.updated_at = NOW(); 
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protheus_modules_master_updated_at 
    ON public.protheus_modules_master;

CREATE TRIGGER trg_protheus_modules_master_updated_at 
BEFORE UPDATE ON public.protheus_modules_master
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_protheus_modules_master(); 

COMMIT;
