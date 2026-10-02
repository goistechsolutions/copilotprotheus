#!/usr/bin/env bash
# scripts/apply_migrations.sh
# Uso (na VPS, dentro do diretorio do projeto):
#   bash scripts/apply_migrations.sh status
#   bash scripts/apply_migrations.sh baseline <ultimo_arquivo_ja_aplicado.sql>
#   bash scripts/apply_migrations.sh apply
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-status}"
BASELINE_UNTIL="${2:-}"
MIG_DIR="${MIG_DIR:-database/migrations}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-copilot}"
DB_NAME="${DB_NAME:-copilotprotheus}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/copilotprotheus}"

psql_run() { docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_run -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   text PRIMARY KEY,
  checksum   text NOT NULL,
  mode       text NOT NULL DEFAULT 'applied',
  applied_by text NOT NULL DEFAULT current_user,
  applied_at timestamptz NOT NULL DEFAULT now())"

mapfile -t FILES < <(find "$MIG_DIR" -maxdepth 1 -type f -name '*.sql' ! -name '*_down.sql' -printf '%f\n' | LC_ALL=C sort)
[ "${#FILES[@]}" -gt 0 ] || { echo "Nenhuma migration encontrada em $MIG_DIR"; exit 1; }

recorded_checksum() { psql_run -tA -c "SELECT checksum FROM public.schema_migrations WHERE filename = '$1'"; }
check_name() { [[ "$1" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "Nome de arquivo invalido: $1"; exit 1; }; }

record() { # arquivo modo
  local sum; sum=$(sha256sum "$MIG_DIR/$1" | awk '{print $1}')
  psql_run -c "INSERT INTO public.schema_migrations(filename, checksum, mode) VALUES ('$1', '$sum', '$2')
               ON CONFLICT (filename) DO NOTHING"
}

case "$MODE" in
status)
  printf '%-70s %s\n' ARQUIVO ESTADO
  for f in "${FILES[@]}"; do
    check_name "$f"
    rec=$(recorded_checksum "$f"); cur=$(sha256sum "$MIG_DIR/$f" | awk '{print $1}')
    if [ -z "$rec" ]; then st=PENDENTE; elif [ "$rec" = "$cur" ]; then st=OK; else st="ALTERADO-APOS-APLICAR"; fi
    printf '%-70s %s\n' "$f" "$st"
  done ;;

baseline)
  [ -n "$BASELINE_UNTIL" ] || { echo "Informe o ultimo arquivo ja aplicado"; exit 1; }
  printf '%s\n' "${FILES[@]}" | grep -qx "$BASELINE_UNTIL" || { echo "Arquivo nao encontrado: $BASELINE_UNTIL"; exit 1; }
  for f in "${FILES[@]}"; do
    check_name "$f"; record "$f" baseline; echo "baseline: $f"
    [ "$f" = "$BASELINE_UNTIL" ] && break
  done ;;

apply)
  PENDING=()
  for f in "${FILES[@]}"; do
    check_name "$f"
    rec=$(recorded_checksum "$f"); cur=$(sha256sum "$MIG_DIR/$f" | awk '{print $1}')
    if [ -z "$rec" ]; then PENDING+=("$f")
    elif [ "$rec" != "$cur" ]; then echo "AVISO: $f foi alterado apos aplicado (nao sera reexecutado)"; fi
  done
  if [ "${#PENDING[@]}" -eq 0 ]; then echo "Nada pendente."; exit 0; fi

  mkdir -p "$BACKUP_DIR"
  DUMP="$BACKUP_DIR/pre_migration_$(date +%Y%m%d_%H%M%S).dump"
  echo "Backup: $DUMP"
  docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DUMP"
  [ -s "$DUMP" ] || { echo "Backup vazio. Abortando."; rm -f "$DUMP"; exit 1; }

  for f in "${PENDING[@]}"; do
    echo "-> Aplicando $f"
    if grep -qiE '^[[:space:]]*BEGIN[[:space:]]*;' "$MIG_DIR/$f"; then
      psql_run < "$MIG_DIR/$f"
    else
      psql_run --single-transaction < "$MIG_DIR/$f"
    fi
    record "$f" applied
    echo "   OK $f"
  done
  echo "Migrations concluidas." ;;
*)
  echo "Modo invalido: $MODE (use status | baseline | apply)"; exit 1 ;;
esac
