-- 20260830_remove_dictionary_environment_scope.sql
--
-- Remove environment_id SOMENTE do catálogo estrutural SX2/SX3/SIX/SXG.
-- O environment_code de conexão permanece em public.protheus_rest_connections,
-- tenant_dictionary_sources e company_info para autenticação, QueryRest e auditoria.
--
-- Aplicação: psql --set ON_ERROR_STOP=1 -f 20260830_remove_dictionary_environment_scope.sql
-- Pré-requisito: backup do PostgreSQL e janela operacional controlada.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';

DO $$
DECLARE
    t RECORD;
    has_groups BOOLEAN;
BEGIN
    FOR t IN
        SELECT LOWER(schema_name) AS schema_name
        FROM public.tenant
        WHERE schema_name IS NOT NULL
          AND LOWER(schema_name) NOT IN ('public', 'information_schema', 'pg_catalog')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = t.schema_name AND table_name = 'dictionary_tables'
        ) THEN
            CONTINUE;
        END IF;

        -- Colunas canônicas e escopo de empresa. Nenhuma empresa é inventada.
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS company_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS active_flag BOOLEAN NOT NULL DEFAULT TRUE', t.schema_name);

        EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);

        EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);

        SELECT to_regclass(format('%I.dictionary_groups', t.schema_name)) IS NOT NULL INTO has_groups;
        IF has_groups THEN
            EXECUTE format('ALTER TABLE %I.dictionary_groups ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_groups ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        END IF;

        -- O tenant é verificável pelo schema proprietário.
        EXECUTE format('UPDATE %I.dictionary_tables SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        EXECUTE format('UPDATE %I.dictionary_fields SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        EXECUTE format('UPDATE %I.dictionary_indexes SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        IF has_groups THEN
            EXECUTE format('UPDATE %I.dictionary_groups SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        END IF;

        -- A empresa só é preenchida quando há uma correspondência estrutural única.
        EXECUTE format($sql$
            UPDATE %I.dictionary_tables dt
               SET company_id = ci.id,
                   company_code = COALESCE(NULLIF(btrim(dt.company_code), ''), ci.company_code)
              FROM %I.company_info ci
             WHERE dt.company_id IS NULL
               AND dt.company_code IS NOT NULL
               AND btrim(dt.company_code) = btrim(ci.company_code)
               AND ci.status IN ('active', 'ativa')
        $sql$, t.schema_name, t.schema_name);

        EXECUTE format($sql$
            UPDATE %I.dictionary_fields df
               SET company_id = dt.company_id,
                   table_name = COALESCE(NULLIF(btrim(df.table_name), ''), dt.table_name)
              FROM %I.dictionary_tables dt
             WHERE df.company_id IS NULL
               AND df.table_code = dt.table_code
               AND dt.company_id IS NOT NULL
        $sql$, t.schema_name, t.schema_name);

        EXECUTE format($sql$
            UPDATE %I.dictionary_indexes di
               SET company_id = dt.company_id,
                   table_name = COALESCE(NULLIF(btrim(di.table_name), ''), dt.table_name)
              FROM %I.dictionary_tables dt
             WHERE di.company_id IS NULL
               AND di.table_code = dt.table_code
               AND dt.company_id IS NOT NULL
        $sql$, t.schema_name, t.schema_name);

        -- Registros sem empresa verificável não podem funcionar como autorização.
        EXECUTE format('UPDATE %I.dictionary_tables SET active_flag = FALSE WHERE company_id IS NULL', t.schema_name);

        -- Remover índices antigos que incluem environment_id antes de eliminar a coluna.
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_tables_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_fields_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_indexes_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_tables_scope', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_fields_scope', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_indexes_scope', t.schema_name);

        EXECUTE format('ALTER TABLE %I.dictionary_tables DROP COLUMN IF EXISTS environment_id', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_fields DROP COLUMN IF EXISTS environment_id', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_indexes DROP COLUMN IF EXISTS environment_id', t.schema_name);
        IF has_groups THEN
            EXECUTE format('ALTER TABLE %I.dictionary_groups DROP COLUMN IF EXISTS environment_id', t.schema_name);
        END IF;

        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_tables_tenant_company_table ON %I.dictionary_tables (tenant_id, company_id, table_code)', t.schema_name);
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_fields_tenant_company_field ON %I.dictionary_fields (tenant_id, company_id, table_code, field_name)', t.schema_name);
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_indexes_tenant_company_order ON %I.dictionary_indexes (tenant_id, company_id, table_code, index_order)', t.schema_name);
        IF has_groups THEN
            EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_groups_tenant_company_group ON %I.dictionary_groups (tenant_id, company_id, group_name)', t.schema_name);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- Pós-validação recomendada:
-- SELECT table_schema, table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema NOT IN ('pg_catalog','information_schema','public')
--   AND table_name IN ('dictionary_tables','dictionary_fields','dictionary_indexes','dictionary_groups')
--   AND column_name = 'environment_id';
-- O resultado deve ser vazio para as tabelas do catálogo. environment_id de RBAC
-- e environment_code de conexão não fazem parte desta migration.
