#!/usr/bin/env bash
# =========================================================
# reset_database.sh
# Reset completo do banco copilot_protheus para o novo modelo
# multi-schema (público + schema por tenant).
# Suporta execução no host ou via container Docker copilot-protheus-db.
# =========================================================
set -euo pipefail

DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"
CONTAINER="${CONTAINER_NAME:-copilot-protheus-db}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

run_pg_dump() {
  local out_file="$1"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$out_file"
  elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -q "$CONTAINER"; then
    docker exec -i "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$out_file"
  else
    echo "⚠️ pg_dump não encontrado e container $CONTAINER indisponível. Pulando backup."
  fi
}

run_psql_cmd() {
  local query="$1"
  if command -v psql >/dev/null 2>&1; then
    psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c "$query"
  elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -q "$CONTAINER"; then
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$query"
  else
    echo "❌ psql não encontrado e container $CONTAINER indisponível."
    exit 1
  fi
}

run_psql_file() {
  local file_path="$1"
  if command -v psql >/dev/null 2>&1; then
    psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$file_path"
  elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -q "$CONTAINER"; then
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$file_path"
  else
    echo "❌ psql não encontrado e container $CONTAINER indisponível."
    exit 1
  fi
}

echo "==> 1/5 Backup de segurança do banco atual (pre_reset_${TIMESTAMP}.sql)"
run_pg_dump "$BACKUP_DIR/pre_reset_${TIMESTAMP}.sql" || true

echo "==> 2/5 Dropando todos os schemas de tenant existentes (tenant_*)"
SCHEMAS=""
if command -v psql >/dev/null 2>&1; then
  SCHEMAS=$(psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';" 2>/dev/null || true)
elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -q "$CONTAINER"; then
  SCHEMAS=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';" 2>/dev/null || true)
fi

for schema in $SCHEMAS; do
  schema=$(echo "$schema" | xargs)
  if [ -n "$schema" ]; then
    echo "   - Dropando schema: $schema"
    run_psql_cmd "DROP SCHEMA IF EXISTS \"$schema\" CASCADE;"
  fi
done

echo "==> 3/5 Limpando schema public (tabelas legadas do modelo antigo)"
run_psql_cmd "
  DROP TABLE IF EXISTS
    tenants, companies, tenant_dictionary_tables, tenant_dictionary_fields,
    tenant_module_contracts, company_modules, agent_users, api_usage_logs,
    query_usage_counters, agent_query_audit, license_plans, tenant_contracts
  CASCADE;
"

echo "==> 4/5 Aplicando novo núcleo global (public)"
CORE_SQL="./etc/01_public_core.sql"
if [ ! -f "$CORE_SQL" ]; then
  CORE_SQL="./01_public_core.sql"
fi
if [ ! -f "$CORE_SQL" ]; then
  CORE_SQL="./sql/01_public_core.sql"
fi

run_psql_file "$CORE_SQL"

echo "==> 5/5 Reset concluído com sucesso!"
