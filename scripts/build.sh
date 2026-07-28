#!/usr/bin/env bash
# build.sh — builda o admin-frontend e copia para backend/static/admin
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/admin-frontend"
DEST="$ROOT/backend/app/static/admin"

echo "\n▶ Instalando dependências do admin-frontend..."
cd "$FRONTEND"
npm ci --frozen-lockfile

echo "\n▶ Buildando admin-frontend..."
npm run build

echo "\n▶ Copiando dist → backend/static/admin..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$FRONTEND/dist/." "$DEST/"

echo "\n✅ Build completo! Admin disponível em backend/static/admin"
