-- Compatibilidade estrutural do catálogo SX2/SX3/SIX/SXG por tenant.
--
-- Esta migration corrige somente metadados estruturais locais do catálogo.
-- Não consulta nem copia dados operacionais do Protheus.
-- environment_code permanece no contexto da conexão/sincronização.
-- environment_id é removido apenas das tabelas do catálogo.
--
-- Execução recomendada:
-- psql -v ON_ERROR_STOP=1 -f 20260831_tenant_dictionary_schema_compatibility.sql

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';

DO $$
DECLARE
    t RECORD;
    invalid_rows BIGINT;
BEGIN
    IF to_regclass('public.tenant') IS NULL THEN
        RAISE EXCEPTION 'Pré-requisito ausente: public.tenant';
    END IF;

    FOR t IN
        SELECT lower(schema_name) AS schema_name
        FROM public.tenant
        WHERE schema_name IS NOT NULL
          AND lower(schema_name) NOT IN ('public', 'information_schema', 'pg_catalog')
    LOOP
        IF to_regclass(format('%I.dictionary_tables', t.schema_name)) IS NULL THEN
            CONTINUE;
        END IF;

        -- Colunas canônicas do catálogo de tabelas.
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS company_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS physical_name VARCHAR(100)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS module_code VARCHAR(20)', t.schema_name);
        EXECUTE format('ALTER TABLE %I.dictionary_tables ADD COLUMN IF NOT EXISTS active_flag BOOLEAN NOT NULL DEFAULT TRUE', t.schema_name);

        -- Colunas canônicas de campos SX3.
        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS field_name VARCHAR(80)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS field_type VARCHAR(1)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS length_num INTEGER', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_fields ADD COLUMN IF NOT EXISTS decimal_num INTEGER', t.schema_name);
        END IF;

        -- Colunas canônicas de índices SIX.
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS table_code VARCHAR(60)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS table_name VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ADD COLUMN IF NOT EXISTS index_order INTEGER', t.schema_name);
        END IF;

        -- O grupo SXG pertence ao catálogo estrutural e não possui ambiente relacional.
        IF to_regclass(format('%I.dictionary_groups', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_groups ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)', t.schema_name);
            EXECUTE format('ALTER TABLE %I.dictionary_groups ADD COLUMN IF NOT EXISTS company_id INTEGER', t.schema_name);
        END IF;

        -- O schema proprietário é a única origem verificável do tenant.
        EXECUTE format('UPDATE %I.dictionary_tables SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('UPDATE %I.dictionary_fields SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('UPDATE %I.dictionary_indexes SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_groups', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('UPDATE %I.dictionary_groups SET tenant_id = %L WHERE tenant_id IS NULL OR btrim(tenant_id) = ''''', t.schema_name, t.schema_name);
        END IF;

        -- Alinha os códigos estruturais para VARCHAR(60), sem converter valores.
        EXECUTE format('ALTER TABLE %I.dictionary_tables ALTER COLUMN table_code TYPE VARCHAR(60)', t.schema_name);
        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_fields ALTER COLUMN table_code TYPE VARCHAR(60)', t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ALTER COLUMN table_code TYPE VARCHAR(60)', t.schema_name);
        END IF;

        -- index_order deve ser inteiro. A conversão só ocorre se todos os valores forem numéricos.
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format($check$
                SELECT count(*)
                FROM %I.dictionary_indexes
                WHERE index_order IS NOT NULL
                  AND btrim(index_order::text) !~ '^[0-9]+$'
            $check$, t.schema_name) INTO invalid_rows;
            IF invalid_rows > 0 THEN
                RAISE EXCEPTION 'Tenant % possui % índices com index_order não numérico', t.schema_name, invalid_rows;
            END IF;
            EXECUTE format('ALTER TABLE %I.dictionary_indexes ALTER COLUMN index_order TYPE INTEGER USING NULLIF(btrim(index_order::text), '''')::INTEGER', t.schema_name);
        END IF;

        -- Resolve company_id somente por correspondência comprovável de company_code.
        EXECUTE format($company$
            UPDATE %I.dictionary_tables dt
               SET company_id = ci.id,
                   company_code = COALESCE(NULLIF(btrim(dt.company_code), ''), ci.company_code)
              FROM %I.company_info ci
             WHERE dt.company_id IS NULL
               AND NULLIF(btrim(dt.company_code), '') IS NOT NULL
               AND btrim(dt.company_code) = btrim(ci.company_code)
               AND lower(coalesce(ci.status, 'active')) IN ('active', 'ativa')
        $company$, t.schema_name, t.schema_name);

        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format($fields$
                UPDATE %I.dictionary_fields df
                   SET company_id = dt.company_id,
                       table_name = COALESCE(NULLIF(btrim(df.table_name), ''), dt.table_name)
                  FROM %I.dictionary_tables dt
                 WHERE df.company_id IS NULL
                   AND df.table_code = dt.table_code
                   AND dt.company_id IS NOT NULL
            $fields$, t.schema_name, t.schema_name);
        END IF;

        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format($indexes$
                UPDATE %I.dictionary_indexes di
                   SET company_id = dt.company_id,
                       table_name = COALESCE(NULLIF(btrim(di.table_name), ''), dt.table_name)
                  FROM %I.dictionary_tables dt
                 WHERE di.company_id IS NULL
                   AND di.table_code = dt.table_code
                   AND dt.company_id IS NOT NULL
            $indexes$, t.schema_name, t.schema_name);
        END IF;

        -- Metadados sem empresa verificável não podem autorizar consultas.
        EXECUTE format('UPDATE %I.dictionary_tables SET active_flag = FALSE WHERE company_id IS NULL', t.schema_name);

        -- Remove o escopo de ambiente somente do catálogo estrutural.
        EXECUTE format('ALTER TABLE %I.dictionary_tables DROP COLUMN IF EXISTS environment_id', t.schema_name);
        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_fields DROP COLUMN IF EXISTS environment_id', t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_indexes DROP COLUMN IF EXISTS environment_id', t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_groups', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.dictionary_groups DROP COLUMN IF EXISTS environment_id', t.schema_name);
        END IF;

        -- Remove índices canônicos antigos somente quando seus nomes forem conhecidos.
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_tables_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_fields_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_dictionary_indexes_snapshot', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_tables_scope', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_fields_scope', t.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.ix_dictionary_indexes_scope', t.schema_name);

        -- Índices por tenant, empresa e chave estrutural.
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_tables_tenant_company_table ON %I.dictionary_tables (tenant_id, company_id, table_code)', t.schema_name);
        IF to_regclass(format('%I.dictionary_fields', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_fields_tenant_company_field ON %I.dictionary_fields (tenant_id, company_id, table_code, field_name)', t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_indexes', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_indexes_tenant_company_order ON %I.dictionary_indexes (tenant_id, company_id, table_code, index_order)', t.schema_name);
        END IF;
        IF to_regclass(format('%I.dictionary_groups', t.schema_name)) IS NOT NULL THEN
            EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_groups_tenant_company_group ON %I.dictionary_groups (tenant_id, company_id, group_name)', t.schema_name);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- Validação pós-execução, somente leitura:
-- SELECT table_schema, table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema NOT IN ('public', 'pg_catalog', 'information_schema')
--   AND table_name IN ('dictionary_tables','dictionary_fields','dictionary_indexes','dictionary_groups')
--   AND column_name = 'environment_id';
-- Resultado esperado: zero linhas.
