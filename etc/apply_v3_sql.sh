#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-copilot_protheus}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"

for file in \
  "$SQL_DIR/001_multitenant_core.sql" \
  "$SQL_DIR/002_rbac_initial.sql" \
  "$SQL_DIR/003_audit_onboarding.sql"; do
  echo "[INFO] Aplicando $(basename "$file")"
  $COMPOSE_CMD exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" < "$file"
done

echo "[INFO] Scripts SQL v3 aplicados com sucesso."
