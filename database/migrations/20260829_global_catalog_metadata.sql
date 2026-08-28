BEGIN;

-- Catálogo global: somente metadados estruturais do Protheus.
-- Não armazenar tenant, empresa, ambiente, URL, usuário, senha, token ou linhas
-- operacionais. Os dados empresariais permanecem no ERP e são consultados via
-- QueryRest autorizado.
ALTER TABLE public.protheus_modules_master
    ADD COLUMN IF NOT EXISTS catalog_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.protheus_modules_master.catalog_metadata IS
    'Metadados SX2/SX3/SIX agrupados por módulo; não contém dados empresariais, credenciais, tenant ou ambiente.';

COMMIT;
