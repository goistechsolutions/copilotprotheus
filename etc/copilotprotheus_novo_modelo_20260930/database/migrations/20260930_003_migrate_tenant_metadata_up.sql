-- Copilot Protheus
-- Migration 20260930_003 UP
-- Instala uma função controlada para copiar metadados legados de um tenant.
-- A função não apaga a origem e não copia tabelas transacionais do ERP.
-- Pré-condição: executar 001 e 002.

BEGIN;

CREATE OR REPLACE FUNCTION public.migrate_legacy_tenant_metadata(
    p_tenant_code varchar,
    p_source_schema varchar
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $migrate$
DECLARE
    v_target_schema text;
    v_count bigint;
    v_result jsonb := '{}'::jsonb;
BEGIN
    IF p_source_schema !~ '^[a-z][a-z0-9_]{2,62}$' THEN
        RAISE EXCEPTION 'source schema inválido: %', p_source_schema;
    END IF;
    IF to_regnamespace(p_source_schema) IS NULL THEN
        RAISE EXCEPTION 'source schema inexistente: %', p_source_schema;
    END IF;

    v_target_schema := public.provision_tenant_schema(p_tenant_code);
    IF v_target_schema = p_source_schema THEN
        RAISE EXCEPTION 'Origem e destino são iguais; é necessária migration estrutural específica in-place';
    END IF;

    -- Módulos contratados passam a ser a lista permitida no schema do tenant.
    EXECUTE format($sql$
        INSERT INTO %I.tenant_modules(module_id, enabled)
        SELECT tmc.module_id, tmc.status IS DISTINCT FROM 'INACTIVE'
          FROM public.tenant_module_contracts tmc
          JOIN public.tenant_contracts tc ON tc.id = tmc.contract_id
         WHERE tmc.tenant_id = $1
           AND tc.tenant_id = $1
        ON CONFLICT (module_id) DO UPDATE SET enabled = EXCLUDED.enabled
    $sql$, v_target_schema) USING p_tenant_code;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('tenant_modules', v_count);

    -- Copia catálogo apenas se as tabelas legadas existem. A seleção permanece filtrada por tenant.
    IF to_regclass(format('%I.dictionary_tables', p_source_schema)) IS NOT NULL THEN
        EXECUTE format($sql$
            INSERT INTO %I.dictionary_tables
                (company_id, table_code, table_name, physical_name, module_id,
                 description, active, metadata_json, created_at, updated_at)
            SELECT
                dt.company_id,
                dt.table_code,
                dt.table_name,
                dt.physical_name,
                pm.id,
                dt.description,
                coalesce(dt.active_flag, true),
                jsonb_build_object(
                    'company_code', dt.company_code,
                    'usa_empresa', dt.usa_empresa,
                    'usa_unidade', dt.usa_unidade,
                    'usa_filial', dt.usa_filial,
                    'x2_modo', dt.x2_modo,
                    'x2_tamfil', dt.x2_tamfil,
                    'x2_modoun', dt.x2_modoun,
                    'x2_tamun', dt.x2_tamun,
                    'x2_modoemp', dt.x2_modoemp,
                    'x2_tamemp', dt.x2_tamemp,
                    'unique_index', dt.unique_index
                ),
                coalesce(dt.created_at, now()),
                coalesce(dt.updated_at, now())
              FROM %I.dictionary_tables dt
              JOIN public.protheus_modules_master pm
                ON pm.id::text = dt.module_code OR pm.module_sigla = upper(dt.module_code)
             WHERE dt.tenant_id = $1
            ON CONFLICT (company_id, physical_name) DO UPDATE SET
                table_code = EXCLUDED.table_code,
                table_name = EXCLUDED.table_name,
                module_id = EXCLUDED.module_id,
                description = EXCLUDED.description,
                active = EXCLUDED.active,
                metadata_json = EXCLUDED.metadata_json,
                updated_at = now()
        $sql$, v_target_schema, p_source_schema) USING p_tenant_code;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('dictionary_tables', v_count);
    END IF;

    IF to_regclass(format('%I.dictionary_fields', p_source_schema)) IS NOT NULL
       AND to_regclass(format('%I.dictionary_tables', p_source_schema)) IS NOT NULL THEN
        EXECUTE format($sql$
            INSERT INTO %I.dictionary_fields
                (dictionary_table_id, field_name, title, field_type, length_num,
                 decimal_num, required, browsable, virtual, validation_rule,
                 semantic_json, created_at, updated_at)
            SELECT
                target_dt.id,
                df.field_name,
                df.title,
                df.field_type,
                df.length_num,
                df.decimal_num,
                coalesce(df.required_flag, false),
                coalesce(df.browse_flag, true),
                coalesce(df.virtual_flag, false),
                df.validation_rule,
                jsonb_build_object('sxg_group', df.sxg_group, 'sxg_size', df.sxg_size),
                coalesce(df.created_at, now()),
                coalesce(df.updated_at, now())
              FROM %I.dictionary_fields df
              JOIN %I.dictionary_tables source_dt
                ON source_dt.tenant_id = df.tenant_id
               AND source_dt.company_id IS NOT DISTINCT FROM df.company_id
               AND source_dt.table_code = df.table_code
              JOIN %I.dictionary_tables target_dt
                ON target_dt.company_id IS NOT DISTINCT FROM source_dt.company_id
               AND target_dt.physical_name = source_dt.physical_name
             WHERE df.tenant_id = $1
            ON CONFLICT (dictionary_table_id, field_name) DO UPDATE SET
                title = EXCLUDED.title,
                field_type = EXCLUDED.field_type,
                length_num = EXCLUDED.length_num,
                decimal_num = EXCLUDED.decimal_num,
                required = EXCLUDED.required,
                browsable = EXCLUDED.browsable,
                virtual = EXCLUDED.virtual,
                validation_rule = EXCLUDED.validation_rule,
                semantic_json = EXCLUDED.semantic_json,
                updated_at = now()
        $sql$, v_target_schema, p_source_schema, p_source_schema, v_target_schema)
        USING p_tenant_code;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('dictionary_fields', v_count);
    END IF;

    -- Converte regras específicas existentes no public para o formato canônico.
    EXECUTE format($sql$
        INSERT INTO %I.business_rules
            (id, rule_type, rule_name, rule_json, version, active, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            'TES',
            'TES:' || tes || ':' || coalesce(direction, ''),
            jsonb_build_object(
                'tes', tes,
                'direction', direction,
                'classification', classification,
                'description', description
            ),
            1,
            coalesce(active, true),
            coalesce(created_at, now()),
            now()
          FROM public.business_rule_tes
         WHERE tenant_id = $1
        ON CONFLICT (company_id, rule_type, rule_name, version) DO NOTHING
    $sql$, v_target_schema) USING p_tenant_code;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('business_rule_tes', v_count);

    RETURN v_result || jsonb_build_object(
        'tenant_code', p_tenant_code,
        'source_schema', p_source_schema,
        'target_schema', v_target_schema,
        'source_preserved', true
    );
END
$migrate$;

REVOKE ALL ON FUNCTION public.migrate_legacy_tenant_metadata(varchar, varchar) FROM PUBLIC;

COMMIT;

-- Exemplo de execução deliberada (não executar sem substituir valores):
-- SELECT public.migrate_legacy_tenant_metadata('TENANT_CODE', 'rodol_prd');
