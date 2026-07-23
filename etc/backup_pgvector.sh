#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TS="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/${DB_NAME}_${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Gerando backup do banco $DB_NAME em $FILE"
$COMPOSE_CMD exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

echo "[INFO] Backup concluído: $FILE"
ls -lh "$FILE"
