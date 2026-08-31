-- Remove environment_id do catálogo estrutural SX2/SX3/SIX.
-- environment_code permanece exclusivamente na conexão, OAuth2, QueryRest
-- e na execução da sincronização. Esta migration não toca dados operacionais do ERP.
BEGIN;

DO $$
DECLARE
    tenant_row RECORD;
BEGIN
    FOR tenant_row IN
        SELECT tenant_code, schema_name
          FROM public.tenant
         WHERE schema_name IS NOT NULL
           AND schema_name NOT IN ('public', 'pg_catalog', 'information_schema')
    LOOP
        IF to_regclass(format('%I.%I', tenant_row.schema_name, 'dictionary_tables')) IS NULL THEN
            CONTINUE;
        END IF;

        -- Garante a empresa como escopo explícito antes de remover o ambiente.
        EXECUTE format(
            'ALTER TABLE %I.dictionary_fields
                ADD COLUMN IF NOT EXISTS company_id INTEGER',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_indexes
                ADD COLUMN IF NOT EXISTS company_id INTEGER',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_groups
                ADD COLUMN IF NOT EXISTS company_id INTEGER',
            tenant_row.schema_name
        );

        -- Não escolher uma empresa arbitrariamente. Linhas sem company_id ficam
        -- inativas para não funcionarem como autorização implícita.
        EXECUTE format(
            'UPDATE %I.dictionary_tables
                SET active_flag = FALSE
              WHERE company_id IS NULL',
            tenant_row.schema_name
        );

        -- Índices antigos que incluíam environment_id deixam de representar o contrato.
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_tables_snapshot', tenant_row.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_fields_snapshot', tenant_row.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_indexes_snapshot', tenant_row.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_tables_scope', tenant_row.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_fields_scope', tenant_row.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_indexes_scope', tenant_row.schema_name);

        EXECUTE format('ALTER TABLE %I.dictionary_tables DROP COLUMN IF EXISTS environment_id', tenant_row.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_fields DROP COLUMN IF EXISTS environment_id', tenant_row.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_indexes DROP COLUMN IF EXISTS environment_id', tenant_row.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_groups DROP COLUMN IF EXISTS environment_id', tenant_row.schema_name);

        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_tables_tenant_company_table
                ON %I.dictionary_tables (tenant_id, company_id, table_code)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_fields_tenant_company_field
                ON %I.dictionary_fields (tenant_id, company_id, table_code, field_name)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_indexes_tenant_company_index
                ON %I.dictionary_indexes (tenant_id, company_id, table_code, index_order)',
            tenant_row.schema_name
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_tables_scope_v2
                ON %I.dictionary_tables (tenant_id, company_id, module_code, table_code)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_fields_scope_v2
                ON %I.dictionary_fields (tenant_id, company_id, table_code, field_name)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_indexes_scope_v2
                ON %I.dictionary_indexes (tenant_id, company_id, table_code, index_order)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_groups_tenant_company_group
                ON %I.dictionary_groups (tenant_id, company_id, group_name)',
            tenant_row.schema_name
        );
    END LOOP;
END $$;

COMMIT;
