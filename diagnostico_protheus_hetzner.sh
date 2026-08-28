#!/usr/bin/env bash
# Diagnóstico seguro de conectividade Hetzner -> Protheus.
# Não lê .env, não executa OAuth2, não usa QueryRest e não imprime segredos.
set -u

BASE_URL="${1:-${PROTHEUS_BASE_URL:-}}"
TIMEOUT="${DIAG_TIMEOUT_SECONDS:-10}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Uso: $0 'https://host:porta/rest'"
  echo "Ou:  PROTHEUS_BASE_URL='https://host:porta/rest' $0"
  exit 2
fi

BASE_URL="${BASE_URL%%[[:space:]]*}"
BASE_URL="${BASE_URL%/}"

if [[ ! "${BASE_URL}" =~ ^https?:// ]]; then
  echo "ERRO: a URL deve iniciar com http:// ou https://"
  exit 2
fi

# Parsing sem imprimir a URL completa quando ela contiver parâmetros acidentais.
URL_INFO="$(python3 - "${BASE_URL}" <<'PY'
import sys
from urllib.parse import urlsplit

raw = sys.argv[1]
p = urlsplit(raw)
if p.username or p.password or p.query or p.fragment:
    print("INVALID_URL_SECRET_OR_QUERY")
    raise SystemExit(3)
if not p.hostname:
    print("INVALID_URL_HOST")
    raise SystemExit(3)
port = p.port or (443 if p.scheme == "https" else 80)
print(f"scheme={p.scheme}")
print(f"hostname={p.hostname}")
print(f"port={port}")
print(f"path={p.path or '/'}")
print(f"token_endpoint_path={(p.path or '').rstrip('/')}/api/oauth2/v1/token")
PY
)"
URL_STATUS=$?
if [[ ${URL_STATUS} -ne 0 ]]; then
  case "${URL_INFO}" in
    INVALID_URL_SECRET_OR_QUERY) echo "ERRO: informe somente a URL base, sem usuário, senha, token, query string ou fragmento." ;;
    *) echo "ERRO: URL inválida ou sem hostname." ;;
  esac
  exit 2
fi

HOST="$(printf '%s\n' "${URL_INFO}" | awk -F= '$1=="hostname"{print $2}')"
PORT="$(printf '%s\n' "${URL_INFO}" | awk -F= '$1=="port"{print $2}')"
SCHEME="$(printf '%s\n' "${URL_INFO}" | awk -F= '$1=="scheme"{print $2}')"

section() { printf '\n===== %s =====\n' "$1"; }

section "CONTEXTO"
printf '%s\n' "${URL_INFO}"
printf '%s\n' "tenant=rodol_prod"
printf '%s\n' "environment=c8te0u_prod"
printf '%s\n' "observacao=nenhuma credencial ou chamada OAuth2/QueryRest sera executada"

section "DNS"
if command -v getent >/dev/null 2>&1; then
  if getent ahosts "${HOST}" | awk '{print $1}' | sort -u; then
    echo "dns_status=ok"
  else
    echo "dns_status=failed"
  fi
else
  echo "dns_status=skipped_getent_unavailable"
fi

section "TCP"
if timeout "${TIMEOUT}" bash -c "</dev/tcp/${HOST}/${PORT}" 2>/dev/null; then
  echo "tcp_status=ok"
else
  echo "tcp_status=failed host=${HOST} port=${PORT}"
fi

section "TLS"
if [[ "${SCHEME}" == "https" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    TLS_OUTPUT="$(timeout "${TIMEOUT}" openssl s_client -connect "${HOST}:${PORT}" -servername "${HOST}" </dev/null 2>&1 | openssl x509 -noout -subject -issuer -dates 2>&1)"
    TLS_STATUS=$?
    if [[ ${TLS_STATUS} -eq 0 ]]; then
      echo "tls_status=ok"
      printf '%s\n' "${TLS_OUTPUT}"
    else
      echo "tls_status=failed"
      echo "tls_detail=certificado nao pode ser lido ou handshake falhou"
    fi
  else
    echo "tls_status=skipped_openssl_unavailable"
  fi
else
  echo "tls_status=not_applicable_http"
fi

section "HTTP SEM AUTENTICACAO"
# Faz apenas uma requisição HEAD à raiz informada; nunca chama token ou QueryRest.
if command -v curl >/dev/null 2>&1; then
  CURL_OUTPUT="$(curl -sS -I -o /dev/null -D - --max-time "${TIMEOUT}" --noproxy '*' "${BASE_URL}/" 2>&1)"
  CURL_STATUS=$?
  if [[ ${CURL_STATUS} -eq 0 ]]; then
    echo "http_status=reachable"
    printf '%s\n' "${CURL_OUTPUT}" | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^server:/ || /^content-type:/ || /^location:/ {print}' | sed -E 's/[[:space:]]+$//' | sed -E 's/(authorization|cookie|set-cookie|token|password|secret)[^:]*:.*/\1: [REDACTED]/I'
  else
    echo "http_status=failed_no_response"
    echo "http_detail=$(printf '%s' "${CURL_OUTPUT}" | tr '\n' ' ' | sed -E 's/(authorization|cookie|token|password|secret)[^ ]*/[REDACTED]/Ig' | cut -c1-300)"
  fi
else
  echo "http_status=skipped_curl_unavailable"
fi

section "DOCKER COMPOSE"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose ps cloudflared backend 2>&1 | sed -E 's/(token|secret|password|authorization|cookie)=?[^[:space:]]*/\1=[REDACTED]/Ig'
  echo "--- cloudflared logs (ultimas 80 linhas, segredos mascarados) ---"
  docker compose logs --tail=80 cloudflared 2>&1 \
    | sed -E 's/(--token[ =]+)[^[:space:]]+/\1[REDACTED]/Ig' \
    | sed -E 's/(CLOUDFLARE_TUNNEL_TOKEN[=:])[^[:space:]]+/\1[REDACTED]/Ig' \
    | sed -E 's/(authorization:?[[:space:]]*(bearer)?)[[:space:]]+[^[:space:]]+/\1 [REDACTED]/Ig' \
    | sed -E 's/(token|secret|password|cookie)=?[^[:space:]]*/\1=[REDACTED]/Ig'
else
  echo "docker_status=skipped_docker_compose_unavailable"
fi

section "INTERPRETACAO"
echo "dns_status=failed      -> corrija DNS/hostname."
echo "tcp_status=failed      -> verifique firewall, porta e AppServer/REST escutando."
echo "tls_status=failed      -> verifique certificado, SNI e cadeia TLS."
echo "http_status=failed     -> verifique rota base /rest, proxy ou serviço REST."
echo "container Exited       -> consulte os logs mascarados do cloudflared e reinicie somente apos identificar a causa."
echo "HTTP 401/403 na raiz   -> rede chegou ao servidor; a autenticacao deve ser validada posteriormente, sem expor credenciais."
echo "HTTP 404 na raiz       -> o host respondeu; confirme a base_rest_url e o contexto do AppServer."
