-- 20260829_dictionary_scope_cleanup.sql
-- Contrato canônico do catálogo importado por tenant.
-- Esta migration trata somente metadados SX2/SX3/SIX e não copia dados operacionais do ERP.
-- Não remove tenant_schemas: ele permanece como cache legado até que todos os leitores
-- administrativos sejam migrados para dictionary_tables.

BEGIN;

DO $$
DECLARE
    tenant_row RECORD;
    null_count BIGINT;
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
        IF to_regclass(format('%I.%I', tenant_row.schema_name, 'dictionary_fields')) IS NULL
           OR to_regclass(format('%I.%I', tenant_row.schema_name, 'dictionary_indexes')) IS NULL THEN
            RAISE EXCEPTION 'Catálogo incompleto no schema %: dictionary_tables, dictionary_fields e dictionary_indexes são obrigatórios', tenant_row.schema_name;
        END IF;

        -- Colunas do contrato canônico. Todas as alterações são aditivas antes do saneamento.
        EXECUTE format(
            'ALTER TABLE %I.dictionary_tables
                ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS environment_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS company_code VARCHAR(20),
                ADD COLUMN IF NOT EXISTS physical_name VARCHAR(80),
                ADD COLUMN IF NOT EXISTS active_flag BOOLEAN NOT NULL DEFAULT TRUE',
            tenant_row.schema_name
        );

        EXECUTE format(
            'ALTER TABLE %I.dictionary_fields
                ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS environment_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS table_code VARCHAR(20),
                ADD COLUMN IF NOT EXISTS table_name VARCHAR(50)',
            tenant_row.schema_name
        );

        EXECUTE format(
            'ALTER TABLE %I.dictionary_indexes
                ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS environment_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS table_code VARCHAR(20),
                ADD COLUMN IF NOT EXISTS table_name VARCHAR(50)',
            tenant_row.schema_name
        );

        -- company_code deve ser textual para preservar códigos como 01.
        EXECUTE format(
            'ALTER TABLE %I.dictionary_tables
                ALTER COLUMN company_code TYPE VARCHAR(20)
                USING company_code::text',
            tenant_row.schema_name
        );

        -- O schema do Tenant é a origem segura do tenant_id; não há inferência a partir
        -- de registros do ERP. O environment_id só é preenchido quando existe conexão
        -- ativa explícita para o par tenant/ambiente.
        EXECUTE format(
            'UPDATE %I.dictionary_tables dt
                SET tenant_id = %L,
                    company_code = COALESCE(NULLIF(BTRIM(dt.company_code), ''''), ci.company_code),
                    environment_id = COALESCE(
                        NULLIF(BTRIM(dt.environment_id), ''''),
                        (
                            SELECT MIN(prc.environment_code)
                              FROM public.protheus_rest_connections prc
                             WHERE prc.tenant_code = %L
                               AND prc.active = TRUE
                            HAVING COUNT(*) = 1
                        )
                    ),
                    table_code = COALESCE(NULLIF(BTRIM(dt.table_code), ''''), NULLIF(BTRIM(dt.table_name), '''')),
                    physical_name = COALESCE(NULLIF(BTRIM(dt.physical_name), ''''), NULLIF(BTRIM(dt.table_name), ''''))
               FROM (
                    SELECT company_code
                      FROM %I.company_info
                     ORDER BY id
                     LIMIT 1
               ) ci',
            tenant_row.schema_name,
            tenant_row.tenant_code,
            tenant_row.tenant_code,
            tenant_row.schema_name
        );

        -- O writer legado não preenchia table_name em dictionary_fields; o vínculo
        -- canônico passa a ser table_code e table_name, sem alterar o conteúdo do ERP.
        EXECUTE format(
            'UPDATE %I.dictionary_fields df
                SET tenant_id = %L,
                    environment_id = COALESCE(NULLIF(BTRIM(df.environment_id), ''''), dt.environment_id),
                    table_code = COALESCE(NULLIF(BTRIM(df.table_code), ''''), NULLIF(BTRIM(df.table_name), '''')),
                    table_name = COALESCE(NULLIF(BTRIM(df.table_name), ''''), NULLIF(BTRIM(df.table_code), ''''))
               FROM %I.dictionary_tables dt
              WHERE (dt.table_code = df.table_code OR dt.table_name = df.table_code)
                AND dt.tenant_id = %L',
            tenant_row.schema_name,
            tenant_row.tenant_code,
            tenant_row.schema_name,
            tenant_row.tenant_code
        );

        EXECUTE format(
            'UPDATE %I.dictionary_indexes di
                SET tenant_id = %L,
                    environment_id = COALESCE(NULLIF(BTRIM(di.environment_id), ''''), dt.environment_id),
                    table_code = COALESCE(NULLIF(BTRIM(di.table_code), ''''), NULLIF(BTRIM(di.table_name), '''')),
                    table_name = COALESCE(NULLIF(BTRIM(di.table_name), ''''), NULLIF(BTRIM(di.table_code), ''''))
               FROM %I.dictionary_tables dt
              WHERE dt.table_code = di.table_name
                AND dt.tenant_id = %L',
            tenant_row.schema_name,
            tenant_row.tenant_code,
            tenant_row.schema_name,
            tenant_row.tenant_code
        );

        EXECUTE format(
            'UPDATE %I.dictionary_tables SET active_flag = TRUE WHERE active_flag IS NULL',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_tables ALTER COLUMN active_flag SET NOT NULL',
            tenant_row.schema_name
        );

        -- Nenhum registro de catálogo pode permanecer sem identidade de Tenant,
        -- ambiente ou chave lógica SX2.
        EXECUTE format(
            'SELECT COUNT(*) FROM %I.dictionary_tables
              WHERE tenant_id IS NULL OR BTRIM(tenant_id) = ''''
                 OR environment_id IS NULL OR BTRIM(environment_id) = ''''
                 OR table_code IS NULL OR BTRIM(table_code) = ''''',
            tenant_row.schema_name
        ) INTO null_count;
        IF null_count > 0 THEN
            RAISE EXCEPTION 'dictionary_tables do schema % possui linhas sem tenant_id, environment_id ou table_code', tenant_row.schema_name;
        END IF;

        EXECUTE format(
            'SELECT COUNT(*) FROM %I.dictionary_fields
              WHERE tenant_id IS NULL OR BTRIM(tenant_id) = ''''
                 OR table_code IS NULL OR BTRIM(table_code) = ''''',
            tenant_row.schema_name
        ) INTO null_count;
        IF null_count > 0 THEN
            RAISE EXCEPTION 'dictionary_fields do schema % possui linhas sem tenant_id ou table_code', tenant_row.schema_name;
        END IF;

        EXECUTE format(
            'SELECT COUNT(*) FROM %I.dictionary_indexes
              WHERE tenant_id IS NULL OR BTRIM(tenant_id) = ''''
                 OR table_code IS NULL OR BTRIM(table_code) = ''''',
            tenant_row.schema_name
        ) INTO null_count;
        IF null_count > 0 THEN
            RAISE EXCEPTION 'dictionary_indexes do schema % possui linhas sem tenant_id ou table_code', tenant_row.schema_name;
        END IF;

        EXECUTE format(
            'ALTER TABLE %I.dictionary_tables
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN environment_id SET NOT NULL,
                ALTER COLUMN table_code SET NOT NULL',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_fields
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN table_code SET NOT NULL',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_indexes
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN table_code SET NOT NULL',
            tenant_row.schema_name
        );

        -- Removemos somente payloads brutos e alias duplicado, que não são usados pelo
        -- contrato ativo. O histórico legado tenant_schemas permanece intacto.
        EXECUTE format(
            'ALTER TABLE %I.dictionary_tables
                DROP COLUMN IF EXISTS table_alias,
                DROP COLUMN IF EXISTS raw_payload',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_fields
                DROP COLUMN IF EXISTS raw_payload,
                DROP COLUMN IF EXISTS relation_rule,
                DROP COLUMN IF EXISTS when_rule',
            tenant_row.schema_name
        );
        EXECUTE format(
            'ALTER TABLE %I.dictionary_indexes
                DROP COLUMN IF EXISTS raw_payload',
            tenant_row.schema_name
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_tables_scope
                ON %I.dictionary_tables (tenant_id, environment_id, company_code, module_code, table_code)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_fields_scope
                ON %I.dictionary_fields (tenant_id, environment_id, table_code, field_name)',
            tenant_row.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_dictionary_indexes_scope
                ON %I.dictionary_indexes (tenant_id, environment_id, table_code, index_order)',
            tenant_row.schema_name
        );
    END LOOP;
END $$;

COMMIT;
