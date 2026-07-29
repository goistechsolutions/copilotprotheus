#!/usr/bin/env bash
# =========================================================
# reset_database.sh
# Reset completo do banco copilot_protheus para o novo modelo
# multi-schema (público + schema por tenant).
# USO: ambiente de desenvolvimento/homologação apenas.
# =========================================================
set -euo pipefail

DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "==> 1/5 Backup de segurança do banco atual (mesmo em dev, por precaução)"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f "$BACKUP_DIR/pre_reset_${TIMESTAMP}.sql"

echo "==> 2/5 Dropando todos os schemas de tenant existentes (tenant_*)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';" \
  | while read -r schema; do
      schema=$(echo "$schema" | xargs)
      if [ -n "$schema" ]; then
        echo "   - Dropando schema: $schema"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
          -c "DROP SCHEMA IF EXISTS \"$schema\" CASCADE;"
      fi
    done

echo "==> 3/5 Limpando schema public (tabelas legadas do modelo antigo)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  DROP TABLE IF EXISTS
    tenants, companies, tenant_dictionary_tables, tenant_dictionary_fields,
    tenant_module_contracts, company_modules, agent_users, api_usage_logs,
    query_usage_counters, agent_query_audit, license_plans, tenant_contracts
  CASCADE;
"

echo "==> 4/5 Aplicando novo núcleo global (public)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f "./sql/01_public_core.sql"

echo "==> 5/5 Reset concluído. Nenhum schema de tenant foi recriado ainda."
echo "    Novos tenants serão provisionados via tenant_provisioning.py no cadastro."
echo "    Backup salvo em: $BACKUP_DIR/pre_reset_${TIMESTAMP}.sql"
