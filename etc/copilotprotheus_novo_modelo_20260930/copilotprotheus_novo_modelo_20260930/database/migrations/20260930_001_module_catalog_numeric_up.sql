-- Copilot Protheus
-- Migration 20260930_001 UP
-- Objetivo: tornar o código real do módulo Protheus a PK numérica canônica.
-- Exemplo obrigatório: 5 | SIGAFAT | Vendas e Faturamento
-- Estratégia expand/contract: preserva a tabela UUID como legado para rollback.

BEGIN;

LOCK TABLE public.protheus_modules_master IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.tenant_module_contracts IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
      FROM public.protheus_modules_master
     WHERE mod_code IS NULL OR mod_sigla IS NULL OR btrim(mod_sigla) = '';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Migration abortada: % módulo(s) sem mod_code/mod_sigla', v_count;
    END IF;

    SELECT count(*) INTO v_count
      FROM (
            SELECT mod_code FROM public.protheus_modules_master
             GROUP BY mod_code HAVING count(*) > 1
      ) d;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Migration abortada: existem mod_code duplicados';
    END IF;

    SELECT count(*) INTO v_count
      FROM (
            SELECT upper(btrim(mod_sigla)) FROM public.protheus_modules_master
             GROUP BY upper(btrim(mod_sigla)) HAVING count(*) > 1
      ) d;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Migration abortada: existem siglas de módulo duplicadas';
    END IF;

    SELECT count(*) INTO v_count
      FROM public.tenant_module_contracts tmc
      LEFT JOIN public.protheus_modules_master pm ON pm.id = tmc.module_id
     WHERE pm.id IS NULL;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Migration abortada: % contrato(s) referenciam módulo UUID inexistente', v_count;
    END IF;

    -- Aborta se houver FKs externas não tratadas explicitamente neste pacote.
    SELECT count(*) INTO v_count
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.protheus_modules_master'::regclass
       AND NOT (nsp.nspname = 'public' AND rel.relname = 'tenant_module_contracts');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Migration abortada: há % FK(s) adicionais para protheus_modules_master; mapear antes do cutover', v_count;
    END IF;
END
$preflight$;

CREATE TABLE public.protheus_modules_master_v2 (
    id          integer PRIMARY KEY,
    module_sigla varchar(32) NOT NULL,
    description varchar(255) NOT NULL,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_protheus_modules_master_v2_sigla UNIQUE (module_sigla),
    CONSTRAINT ck_protheus_modules_master_v2_id_positive CHECK (id > 0),
    CONSTRAINT ck_protheus_modules_master_v2_sigla_upper CHECK (module_sigla = upper(module_sigla))
);

INSERT INTO public.protheus_modules_master_v2
    (id, module_sigla, description, active, created_at, updated_at)
SELECT
    mod_code,
    upper(btrim(mod_sigla)),
    left(coalesce(nullif(btrim(mod_name), ''), nullif(btrim(description), ''), upper(btrim(mod_sigla))), 255),
    coalesce(active, true),
    coalesce(created_at, now()),
    coalesce(updated_at, now())
FROM public.protheus_modules_master;

-- Garante o registro canônico solicitado sem sobrescrever silenciosamente uma sigla conflitante.
DO $sigafat$
DECLARE
    v_sigla text;
BEGIN
    SELECT module_sigla INTO v_sigla
      FROM public.protheus_modules_master_v2
     WHERE id = 5;

    IF v_sigla IS NOT NULL AND v_sigla <> 'SIGAFAT' THEN
        RAISE EXCEPTION 'Migration abortada: o módulo id=5 já está associado a %', v_sigla;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.protheus_modules_master_v2
         WHERE module_sigla = 'SIGAFAT' AND id <> 5
    ) THEN
        RAISE EXCEPTION 'Migration abortada: SIGAFAT já está associado a outro ID';
    END IF;
END
$sigafat$;

INSERT INTO public.protheus_modules_master_v2
    (id, module_sigla, description, active)
VALUES
    (5, 'SIGAFAT', 'Vendas e Faturamento', true)
ON CONFLICT (id) DO UPDATE
SET module_sigla = EXCLUDED.module_sigla,
    description = EXCLUDED.description,
    active = true,
    updated_at = now();

ALTER TABLE public.tenant_module_contracts
    ADD COLUMN module_id_new integer;

UPDATE public.tenant_module_contracts tmc
   SET module_id_new = pm.mod_code
  FROM public.protheus_modules_master pm
 WHERE pm.id = tmc.module_id;

DO $contracts$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.tenant_module_contracts WHERE module_id_new IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration abortada: contrato sem mapeamento numérico de módulo';
    END IF;
END
$contracts$;

ALTER TABLE public.tenant_module_contracts
    ALTER COLUMN module_id_new SET NOT NULL;

-- Remove somente FKs da coluna antiga module_id nessa tabela.
DO $drop_fk$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
          FROM pg_constraint c
         WHERE c.contype = 'f'
           AND c.conrelid = 'public.tenant_module_contracts'::regclass
           AND EXISTS (
               SELECT 1
                 FROM unnest(c.conkey) k(attnum)
                 JOIN pg_attribute a
                   ON a.attrelid = c.conrelid AND a.attnum = k.attnum
                WHERE a.attname = 'module_id'
           )
    LOOP
        EXECUTE format('ALTER TABLE public.tenant_module_contracts DROP CONSTRAINT %I', r.conname);
    END LOOP;
END
$drop_fk$;

ALTER TABLE public.tenant_module_contracts DROP COLUMN module_id;
ALTER TABLE public.tenant_module_contracts RENAME COLUMN module_id_new TO module_id;

ALTER TABLE public.protheus_modules_master
    RENAME TO protheus_modules_master_legacy_uuid;
ALTER TABLE public.protheus_modules_master_v2
    RENAME TO protheus_modules_master;

ALTER TABLE public.tenant_module_contracts
    ADD CONSTRAINT fk_tenant_module_contracts_module
    FOREIGN KEY (module_id)
    REFERENCES public.protheus_modules_master(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tenant_module_contracts_module_id
    ON public.tenant_module_contracts(module_id);

-- Compatibilidade somente para leitura durante o cutover do código.
CREATE VIEW public.protheus_modules_legacy_compat AS
SELECT
    id AS mod_code,
    module_sigla AS mod_sigla,
    description AS mod_name,
    description,
    active,
    created_at,
    updated_at
FROM public.protheus_modules_master;

COMMENT ON TABLE public.protheus_modules_master IS
'Catálogo canônico de módulos Protheus. PK numérica = código real; module_sigla = SIGA*; description = nome amigável.';
COMMENT ON VIEW public.protheus_modules_legacy_compat IS
'View temporária de compatibilidade. Não usar em novos contratos.';

COMMIT;
