#!/usr/bin/env bash
set -euo pipefail

# Execute na raiz do repositório. Gera um inventário verificável de referências.
OUT="new-model-reference-map.txt"
: > "$OUT"

patterns=(
  'protheus_modules_master'
  'mod_code'
  'mod_sigla'
  'mod_name'
  'tenant_module_contracts'
  'module_id'
  'tenant_table_permissions'
  'tenant_field_permissions'
  'copilot_conversations'
  'copilot_messages'
  'copilot_dashboards'
  'business_rule_tes'
  'business_cfop_rules'
  'business_financial_natures'
  'rodol_prd'
  'schema_name'
  'search_path'
)

for p in "${patterns[@]}"; do
  printf '\n===== %s =====\n' "$p" >> "$OUT"
  if command -v rg >/dev/null 2>&1; then
    rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!dist/**' --glob '!build/**' "$p" . >> "$OUT" || true
  else
    grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build "$p" . >> "$OUT" || true
  fi
done

printf 'Mapa gerado em %s\n' "$OUT"
