-- Copilot Protheus
-- Verificação pós-migration. Somente leitura.

-- 1. Catálogo canônico e registro solicitado.
SELECT id, module_sigla, description, active
  FROM public.protheus_modules_master
 ORDER BY id;

SELECT CASE
         WHEN EXISTS (
              SELECT 1 FROM public.protheus_modules_master
               WHERE id = 5
                 AND module_sigla = 'SIGAFAT'
                 AND description = 'Vendas e Faturamento'
                 AND active
         ) THEN 'OK'
         ELSE 'FAIL: SIGAFAT'
       END AS module_catalog_check;

-- 2. Contratos órfãos.
SELECT count(*) AS orphan_module_contracts
  FROM public.tenant_module_contracts tmc
  LEFT JOIN public.protheus_modules_master pm ON pm.id = tmc.module_id
 WHERE pm.id IS NULL;

-- 3. Tenants sem schema válido/provisionado.
SELECT tenant_code, schema_name, status, provisioned_at
  FROM public.tenant
 WHERE status IS DISTINCT FROM 'DECOMMISSIONED'
   AND (
        schema_name IS NULL
        OR schema_name !~ '^[a-z][a-z0-9_]{2,62}$'
        OR to_regnamespace(schema_name) IS NULL
   )
 ORDER BY tenant_code;

-- 4. FKs atuais para o catálogo de módulos.
SELECT
    n.nspname AS referencing_schema,
    c.relname AS referencing_table,
    con.conname AS constraint_name
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE con.contype = 'f'
  AND con.confrelid = 'public.protheus_modules_master'::regclass
ORDER BY 1, 2, 3;

-- 5. Estruturas legadas ainda presentes (esperado durante expand/contract).
SELECT to_regclass('public.protheus_modules_master_legacy_uuid') AS legacy_module_catalog,
       to_regclass('public.copilot_conversations') AS legacy_public_conversations,
       to_regclass('rodol_prd.tenant_table_permissions') AS legacy_table_permissions,
       to_regclass('rodol_prd.tenant_field_permissions') AS legacy_field_permissions;
