#!/usr/bin/env bash
# scripts/provision_empty_tenant_schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TENANT="${1:?Informe tenant_code}"
SVC="${DB_SERVICE:-db}"
U="${DB_USER:-copilot}"
DB="${DB_NAME:-copilotprotheus}"
P() { docker compose exec -T "$SVC" psql -U "$U" -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }
P -c "SELECT public.provision_tenant_by_schema_key('$TENANT');"
P -c "SELECT id, tenant_code, schema_name, schema_key, status, provisioned_at FROM public.tenant WHERE tenant_code='$TENANT';"
