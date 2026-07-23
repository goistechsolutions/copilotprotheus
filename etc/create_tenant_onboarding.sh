#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 6 ]]; then
  echo "Uso: $0 <tenant_code> <tenant_name> <company_code> <company_name> <project_code> <project_name>"
  exit 1
fi

TENANT_CODE="$1"
TENANT_NAME="$2"
COMPANY_CODE="$3"
COMPANY_NAME="$4"
PROJECT_CODE="$5"
PROJECT_NAME="$6"
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E 'db|postgres' | head -n1)}"
DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"

if [[ -z "$DB_CONTAINER" ]]; then
  echo "[ERRO] Não foi possível localizar o container do banco. Defina DB_CONTAINER."
  exit 1
fi

docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
WITH ins_tenant AS (
  INSERT INTO tenants (tenant_code, tenant_name)
  VALUES ('$TENANT_CODE', '$TENANT_NAME')
  ON CONFLICT (tenant_code) DO UPDATE SET tenant_name = EXCLUDED.tenant_name, updated_at = NOW()
  RETURNING id
), sel_tenant AS (
  SELECT id FROM ins_tenant
  UNION
  SELECT id FROM tenants WHERE tenant_code = '$TENANT_CODE'
  LIMIT 1
), ins_company AS (
  INSERT INTO companies (tenant_id, company_code, company_name)
  SELECT id, '$COMPANY_CODE', '$COMPANY_NAME' FROM sel_tenant
  ON CONFLICT (tenant_id, company_code) DO UPDATE SET company_name = EXCLUDED.company_name, updated_at = NOW()
  RETURNING id, tenant_id
), sel_company AS (
  SELECT id, tenant_id FROM ins_company
  UNION
  SELECT c.id, c.tenant_id
  FROM companies c
  JOIN tenants t ON t.id = c.tenant_id
  WHERE t.tenant_code = '$TENANT_CODE' AND c.company_code = '$COMPANY_CODE'
  LIMIT 1
)
INSERT INTO onboarding_projects (tenant_id, company_id, project_code, project_name, onboarding_status)
SELECT tenant_id, id, '$PROJECT_CODE', '$PROJECT_NAME', 'planned' FROM sel_company
ON CONFLICT (tenant_id, project_code) DO UPDATE SET project_name = EXCLUDED.project_name, updated_at = NOW();
SQL

echo "[INFO] Tenant, empresa e projeto de onboarding preparados."
