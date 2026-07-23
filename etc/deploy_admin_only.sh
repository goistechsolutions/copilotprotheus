#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-admin-frontend}"

cd "$PROJECT_DIR"

echo "[INFO] Atualizando branch $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[INFO] Rebuild do serviço $SERVICE_NAME"
$COMPOSE_CMD build --no-cache "$SERVICE_NAME"
$COMPOSE_CMD up -d "$SERVICE_NAME"
$COMPOSE_CMD ps "$SERVICE_NAME"

echo "[INFO] Deploy do admin finalizado"
