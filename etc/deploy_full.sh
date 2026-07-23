#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
BRANCH="${BRANCH:-main}"

cd "$PROJECT_DIR"

echo "[INFO] Projeto: $PROJECT_DIR"
echo "[INFO] Atualizando branch $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[INFO] Build completo sem cache (serviços VPS)"
$COMPOSE_CMD build --no-cache backend middleware admin-frontend

echo "[INFO] Subindo stack (serviços VPS)"
$COMPOSE_CMD up -d db backend middleware admin-frontend adminer cloudflared

echo "[INFO] Containers ativos"
$COMPOSE_CMD ps

echo "[INFO] Finalizado com sucesso"
