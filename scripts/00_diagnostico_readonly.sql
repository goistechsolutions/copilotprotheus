-- 00_diagnostico_readonly.sql  (SOMENTE LEITURA - pode rodar no DBeaver com Alt+X)
SELECT '01_schemas' AS bloco, table_schema, count(*) AS tabelas
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
GROUP BY table_schema ORDER BY table_schema;

SELECT '02_funcoes_factory' AS bloco, p.oid::regprocedure::text AS funcao
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('provision_tenant_schema','migrate_legacy_tenant_metadata');

SELECT '03_tenants' AS bloco, id, tenant_code, schema_name, status, provisioned_at
FROM public.tenant ORDER BY id;

SELECT '04_catalogo' AS bloco,
       (SELECT count(*) FROM public.protheus_modules_master) AS qtd_novo,
       (SELECT count(*) FROM public.protheus_modules_master_legacy_uuid) AS qtd_legado;

SELECT '05_contratos_tipo_module_id' AS bloco, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tenant_module_contracts' AND column_name='module_id';

SELECT '06_contratos_orfaos' AS bloco, count(*) AS orfaos
FROM public.tenant_module_contracts c
LEFT JOIN public.protheus_modules_master m ON m.id = c.module_id
WHERE m.id IS NULL;

SELECT '07_fks_para_catalogo' AS bloco, conrelid::regclass::text AS tabela, conname,
       pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE contype='f' AND confrelid = 'public.protheus_modules_master'::regclass;

SELECT '08_views_com_mod_code' AS bloco, schemaname, viewname
FROM pg_views
WHERE definition ILIKE '%mod_code%' AND schemaname NOT IN ('pg_catalog','information_schema');

SELECT '09_extensao_vector' AS bloco, e.extname, n.nspname AS schema_da_extensao
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';

SELECT '10_controle_migrations' AS bloco, to_regclass('public.schema_migrations')::text AS tabela_controle;

SELECT '11_linhas_modelo_antigo' AS bloco, schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE relname IN ('tenant_table_permissions','tenant_field_permissions','company_info',
                  'business_field_aliases','business_rule_tes','business_cfop_rules',
                  'business_financial_natures','copilot_conversations','copilot_messages',
                  'copilot_dashboards','dictionary_tables','dictionary_fields')
ORDER BY schemaname, relname;

SELECT '12_modulo_5' AS bloco, id, module_sigla, description, active
FROM public.protheus_modules_master WHERE id = 5;
