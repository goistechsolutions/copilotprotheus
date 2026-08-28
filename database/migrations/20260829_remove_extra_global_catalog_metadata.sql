BEGIN;

-- public.protheus_modules_master mantém somente o catálogo global simples:
-- código do módulo, sigla e descrição. Nenhum dado empresarial é armazenado.
ALTER TABLE public.protheus_modules_master
    DROP COLUMN IF EXISTS catalog_metadata;

COMMIT;
