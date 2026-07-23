#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker-compose}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
ADMIN_URL="${ADMIN_URL:-http://127.0.0.1:5174}"
DB_HOST_PORT="${DB_HOST_PORT:-5435}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

check_url() {
  local name="$1"
  local url="$2"
  echo "[CHECK] $name -> $url"
  if curl -fsS --max-time 10 "$url" >/dev/null; then
    echo "[OK] $name"
  else
    echo "[ERRO] Falha em $name ($url)"
  fi
}

echo "[INFO] Status dos containers"
$COMPOSE_CMD ps || true

echo "[INFO] Teste de portas locais"
ss -lntp | grep -E ":(${DB_HOST_PORT}|8000|5174|3001|11434)\b" || true

check_url "Backend root" "$BACKEND_URL/"
check_url "Backend docs" "$BACKEND_URL/docs"
check_url "Admin frontend" "$ADMIN_URL/"
check_url "Ollama tags" "$OLLAMA_URL/api/tags"

echo "[INFO] Teste PostgreSQL host port $DB_HOST_PORT"
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h 127.0.0.1 -p "$DB_HOST_PORT" || true
else
  echo "[WARN] pg_isready não instalado no host"
fi

echo "[INFO] Healthcheck finalizado"
