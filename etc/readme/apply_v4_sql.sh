#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-copilot_protheus}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"

for file in \
  "$SQL_DIR/004_product_governance_dictionary.sql" \
  "$SQL_DIR/005_product_governance_seed.sql" \
  "$SQL_DIR/006_dictionary_sync_support.sql"; do
  echo "[INFO] Aplicando $(basename "$file")"
  $COMPOSE_CMD exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" < "$file"
done

echo "[INFO] SQL v4 aplicado com sucesso."
