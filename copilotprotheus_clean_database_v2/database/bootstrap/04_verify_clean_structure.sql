-- Deve retornar zero: conteúdo conversacional não pode existir em public.
SELECT count(*) AS forbidden_public_chat_tables
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'copilot_conversations','copilot_messages','copilot_analyses',
    'copilot_dashboards','copilot_sessions','copilot_favorites','copilot_events'
  );

-- Deve retornar 2.0.0.
SELECT version, description, applied_at
FROM public.schema_versions
ORDER BY applied_at DESC
LIMIT 1;

-- Tenants provisionados e respectivos schemas.
SELECT t.tenant_code, t.schema_name, t.status,
       to_regnamespace(t.schema_name) IS NOT NULL AS schema_exists
FROM public.tenants t
ORDER BY t.tenant_code;

-- Para cada tenant provisionado, confirme as tabelas obrigatórias.
SELECT t.tenant_code, required.table_name,
       to_regclass(format('%I.%I', t.schema_name, required.table_name)) IS NOT NULL AS exists
FROM public.tenants t
CROSS JOIN (VALUES
 ('companies'),('environments'),('tenant_modules'),('business_rule_sets'),
 ('business_revenue_configs'),('business_receivable_configs'),
 ('business_inventory_configs'),('business_abc_configs'),('dictionary_snapshots'),('dictionary_tables'),('dictionary_fields'),
 ('documents'),('document_chunks'),('memories'),
 ('copilot_conversations'),('copilot_messages'),('copilot_analyses'),
 ('copilot_dashboards'),('copilot_sessions'),('copilot_favorites'),
 ('copilot_events'),('agent_query_audit')
) AS required(table_name)
ORDER BY t.tenant_code, required.table_name;
