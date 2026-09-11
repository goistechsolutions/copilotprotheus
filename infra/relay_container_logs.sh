#!/usr/bin/env bash
set -Eeuo pipefail

DEST_DIR="${CONTAINER_LOG_DIR:-/var/log/copilotprotheus}"
TAIL_LINES="${CONTAINER_LOG_LINES:-500}"
mkdir -p "$DEST_DIR"
umask 077

sanitize() {
  sed -E \
    -e 's/(Authorization[[:space:]]*:[[:space:]]*Bearer[[:space:]]+)[^ ,}]+/\1[REDACTED]/Ig' \
    -e 's/((password|secret|token|api[_-]?key)[[:space:]]*[:=][[:space:]]*)[^ ,}]+/\1[REDACTED]/Ig' \
    -e 's/((cquery|_queryparam|query)[[:space:]]*[:=][[:space:]]*)[^,}]+/\1[SQL_REDACTED]/Ig'
}

for service in backend middleware frontend db cloudflared; do
  container="copilot-protheus-${service}"
  tmp="${DEST_DIR}/.${service}.log.tmp"
  if docker inspect "$container" >/dev/null 2>&1; then
    docker logs --timestamps --tail "$TAIL_LINES" "$container" 2>&1 | sanitize > "$tmp"
    chmod 0600 "$tmp"
    mv -f "$tmp" "${DEST_DIR}/${service}.log"
  else
    printf '%s\n' "container=${container} status=not_found" > "$tmp"
    chmod 0600 "$tmp"
    mv -f "$tmp" "${DEST_DIR}/${service}.log"
  fi
done
