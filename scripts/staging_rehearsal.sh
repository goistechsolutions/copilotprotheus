#!/usr/bin/env bash
# scripts/staging_rehearsal.sh - ensaio em copia do banco (NAO altera copilotprotheus)
# Uso na VPS: bash scripts/staging_rehearsal.sh [tenant_code]
set -euo pipefail
cd "$(dirname "$0")/.."
TENANT="${1:-rodol_prd}"
[[ "$TENANT" =~ ^[a-z][a-z0-9_]{1,50}$ ]] || { echo "tenant_code invalido"; exit 1; }
SVC="${DB_SERVICE:-db}"; U="${DB_USER:-copilot}"; SRC="${DB_NAME:-copilotprotheus}"; STG="copilot_staging"
P() { docker compose exec -T "$SVC" psql -U "$U" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "== 1. Recriando $STG a partir de $SRC"
P -d postgres -c "DROP DATABASE IF EXISTS $STG" -c "CREATE DATABASE $STG"
docker compose exec -T "$SVC" pg_dump -U "$U" -d "$SRC" -Fc | docker compose exec -T "$SVC" pg_restore -U "$U" -d "$STG" --no-owner

echo "== 2. Aplicando migration do schema de destino em $STG"
P -d "$STG" < database/migrations/20261002_001_tenant_target_schema_up.sql

echo "== 3. Provisionando e migrando metadados ($TENANT)"
P -d "$STG" -c "SELECT public.provision_tenant_target_schema('$TENANT')"
P -d "$STG" -c "SELECT public.migrate_tenant_to_target_schema('$TENANT')"

echo "== 4. Conferencia"
P -d "$STG" -c "SELECT tenant_code, schema_name, target_schema_name, provisioned_at FROM public.tenant WHERE tenant_code='$TENANT'"
P -d "$STG" -c "SELECT table_schema, count(*) AS tabelas FROM information_schema.tables WHERE table_schema IN ('rodol_prd','tenant_$TENANT') GROUP BY 1 ORDER BY 1"
P -d "$STG" -c "SELECT 'dictionary_tables' AS item,
  (SELECT count(*) FROM rodol_prd.dictionary_tables WHERE tenant_id='$TENANT') AS legado_do_tenant,
  (SELECT count(*) FROM rodol_prd.dictionary_tables) AS legado_total,
  (SELECT count(*) FROM tenant_$TENANT.dictionary_tables) AS novo
UNION ALL SELECT 'dictionary_fields',
  (SELECT count(*) FROM rodol_prd.dictionary_fields WHERE tenant_id='$TENANT'),
  (SELECT count(*) FROM rodol_prd.dictionary_fields),
  (SELECT count(*) FROM tenant_$TENANT.dictionary_fields)"
echo "== Ensaio concluido. Para descartar: docker compose exec -T $SVC psql -U $U -d postgres -c 'DROP DATABASE $STG'"
