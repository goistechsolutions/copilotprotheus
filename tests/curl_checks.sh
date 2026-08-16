#!/usr/bin/env bash
set -euo pipefail
API="${API:-https://copilot-api.elitecorp.tec.br/api}"
ORIGIN="${ORIGIN:-https://copilot.elitecorp.tec.br}"
TENANT_ID="${TENANT_ID:-default}"
COMPANY_ID="${COMPANY_ID:-default}"
curl -i -X OPTIONS "$API/agent/ask/v2" -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,authorization"
curl -i "$API/health"
curl -i -X POST "$API/agent/ask/v2" -H "Origin: $ORIGIN" -H "Content-Type: application/json" -d "{\"query\":\"test\",\"tenant_id\":\"$TENANT_ID\",\"company_id\":\"$COMPANY_ID\",\"context\":{\"module\":\"FIN\"}}"
