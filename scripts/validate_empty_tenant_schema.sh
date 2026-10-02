#!/usr/bin/env bash
# scripts/validate_empty_tenant_schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TENANT="${1:?Informe tenant_code}"
SVC="${DB_SERVICE:-db}"; U="${DB_USER:-copilot}"; DB="${DB_NAME:-copilotprotheus}"
P() { docker compose exec -T "$SVC" psql -U "$U" -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }
P -c "SELECT public.provision_empty_tenant_schema('$TENANT');"
P -c "SELECT id, tenant_code, schema_name, schema_key, status, provisioned_at FROM public.tenant WHERE tenant_code='$TENANT';"
P -c "SELECT table_name FROM information_schema.tables WHERE table_schema=(SELECT schema_key FROM public.tenant WHERE tenant_code='$TENANT') ORDER BY table_name;"
P -c "SELECT table_name, count(*) AS registros FROM information_schema.tables t JOIN public.tenant x ON x.tenant_code='$TENANT' AND t.table_schema=x.schema_key GROUP BY table_name ORDER BY table_name;"
