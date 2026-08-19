#!/usr/bin/env bash
# =========================================================
# reset_database.sh
# Reset completo do banco copilot_protheus para o novo modelo
# multi-schema (público + schema por tenant).
# Suporta execução no host ou via container Docker copilot-protheus-db.
# =========================================================
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CONTAINER="${CONTAINER_NAME:-copilot-protheus-db}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

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

echo "==> 2/5 Dropando todos os schemas de tenant existentes"
SCHEMAS=""
IF_QUERY="SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'default') AND schema_name NOT LIKE 'pg_%';"
if command -v psql >/dev/null 2>&1; then
  SCHEMAS=$(psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "$IF_QUERY" 2>/dev/null || true)
elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -q "$CONTAINER"; then
  SCHEMAS=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "$IF_QUERY" 2>/dev/null || true)
fi

for schema in $SCHEMAS; do
  schema=$(echo "$schema" | xargs)
  if [ -n "$schema" ]; then
    echo "   - Dropando schema: $schema"
    run_psql_cmd "DROP SCHEMA IF EXISTS \"$schema\" CASCADE;"
  fi
done

echo "==> 3/5 Limpando schema public (removendo tabelas legadas do modelo antigo)"
run_psql_cmd "
  DROP TABLE IF EXISTS
    public.dictionary_tables, public.dictionary_fields, public.dictionary_indexes, public.dictionary_groups,
    public.tenant_dictionary_sources, public.tenant_table_permissions, public.tenant_field_permissions,
    public.tenant_allowed_tables, public.tenant_allowed_fields, public.tenant_dictionary_tables,
    public.tenant_dictionary_fields, public.tenant_dictionary_indexes, public.dictionary_snapshots,
    public.company_modules, public.agent_roles, public.agent_users, public.api_usage_logs,
    public.query_usage_counters, public.agent_query_audit, public.license_plans, public.tenant_contracts,
    public.tenants, public.companies, public.tenant_registry, public.plans, public.platform_admins,
    public.protheus_modules_master, public.platform_audit_log,public.environments,public.license_plans,
    public.permissions,public.tenant_allowed_tables,public.tenant_connectors,public.tenant_dictionary_sources,
    public.tenant_table_permissions,public.tenant_field_permissions,tenant_module_contracts,agent_roles,agent_users
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

echo "==> 4.5/5 Aplicando novas migrations (database/migrations/*.sql)"
MIGRATIONS_DIR="./database/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    echo "   - Aplicando migration: $migration_file"
    run_psql_file "$migration_file"
  done
else
  echo "   - Diretorio $MIGRATIONS_DIR nao encontrado. Nenhuma migration aplicada."
fi

echo "==> 5/5 Reset concluído com sucesso!"
