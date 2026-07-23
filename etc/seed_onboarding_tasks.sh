#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <project_code>"
  exit 1
fi

PROJECT_CODE="$1"
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E 'db|postgres' | head -n1)}"
DB_NAME="${DB_NAME:-copilot_protheus}"
DB_USER="${DB_USER:-postgres}"

if [[ -z "$DB_CONTAINER" ]]; then
  echo "[ERRO] Não foi possível localizar o container do banco. Defina DB_CONTAINER."
  exit 1
fi

docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
WITH prj AS (
  SELECT id FROM onboarding_projects WHERE project_code = '$PROJECT_CODE' LIMIT 1
)
INSERT INTO onboarding_tasks (onboarding_project_id, task_code, task_name, task_type, mandatory)
SELECT prj.id, x.task_code, x.task_name, x.task_type, x.mandatory
FROM prj,
(
  VALUES
    ('DISCOVERY','Levantamento de requisitos e escopo','functional',TRUE),
    ('PROTHEUS_CONN','Validação de conectividade Protheus','integration',TRUE),
    ('RAG_BASE','Carga da base documental inicial','rag',TRUE),
    ('RBAC_SETUP','Configuração de usuários e perfis','security',TRUE),
    ('HOMOLOG','Execução do roteiro de homologação','qa',TRUE),
    ('GO_LIVE','Checklist final de go-live','release',TRUE)
) AS x(task_code, task_name, task_type, mandatory)
ON CONFLICT (onboarding_project_id, task_code) DO NOTHING;
SQL

echo "[INFO] Tarefas padrão de onboarding criadas para $PROJECT_CODE."
