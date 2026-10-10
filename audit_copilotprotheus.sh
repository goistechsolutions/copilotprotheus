#!/usr/bin/env bash
# audit_copilotprotheus.sh — auditoria READ-ONLY (nao altera nada, nao le .env).
# Uso (na raiz do repo):  bash audit_copilotprotheus.sh > audit-report.txt
# Antes de compartilhar o relatorio, revise: ele NAO imprime valores de segredos,
# apenas arquivo:linha.
set +e
EXC='--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=dist --exclude=*.lock --exclude=package-lock.json'
sec() { printf '\n===== %s =====\n' "$1"; }
g()   { grep -rnI $EXC -E "$1" . 2>/dev/null | cut -c1-160 | head -${2:-40}; }
gl()  { grep -rlI $EXC -E "$1" . 2>/dev/null | head -${2:-40}; }

sec "01 Arvore e versoes de schema/migrations"
ls database database/migrations database/diagnostico 2>&1 | head -60
ls alembic.ini alembic backend/alembic.ini backend/alembic 2>&1 | head -5

sec "02 Referencias ao catalogo de modulos (UUID legado vs id inteiro)"
gl 'protheus_modules_master|mod_code|mod_sigla|mod_name|tenant_module_contracts'
g  'module_id|moduleId' 30

sec "03 Estruturas candidatas a descontinuacao ainda referenciadas"
g 'tenant_table_permissions|tenant_field_permissions|company_info|business_field_aliases|business_rule_tes|business_cfop_rules|business_financial_natures' 40
g 'copilot_conversations|copilot_messages|copilot_dashboards|copilot_favorites|copilot_sessions|copilot_events' 40

sec "04 Schema de tenant hardcoded / search_path"
g 'rodol_prd|search_path|schema_name' 40

sec "05 Isolamento: SQL montado por string (risco de injection e de falta de tenant)"
g 'execute\(f["'"'"']|text\(f["'"'"']|\.format\(.*(SELECT|FROM)|%s.*(SELECT|FROM)' 40
g 'tenant_id *= *|tenant_code *= *' 20

sec "06 Guarda de SQL do copilot (SELECT-only, D_E_L_E_T_, timeout)"
g 'D_E_L_E_T_|R_E_C_N_O_|statement_timeout|readonly|SELECT[- ]only|query_guard|QueryGuard' 30

sec "07 Segredos e arquivos sensiveis (apenas localizacao)"
git ls-files 2>/dev/null | grep -E '(^|/)\.env($|\.)|\.pem$|id_rsa|\.dump$|\.sql\.gz$' | grep -v '\.env\.example'
grep -rnIE $EXC '(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["'"'"'][^"'"'"' ]{6,}' . 2>/dev/null | grep -viE 'example|changeme|your_|xxx|placeholder|test' | sed -E 's/([:=]\s*["'"'"']).*/\1***/' | head -30

sec "08 CORS, auth e exposicao"
g 'allow_origins|allow_credentials|CORSMiddleware' 10
g 'Depends\(.*(auth|current_user|get_user)' 5
grep -rnE '5432:5432|ports:' docker-compose*.yml 2>/dev/null | head -10

sec "09 Infra: servicos do compose e workflow de deploy"
grep -nE '^\s{2}[a-z_-]+:\s*$|image:|container_name' docker-compose*.yml 2>/dev/null | head -30
ls .github/workflows scripts 2>&1 | head -20

sec "10 Objeto Analysis / AnalysisContext no codigo"
g 'analyses|AnalysisContext|analysis_id' 20

sec "11 Rotas e testes"
gl '@(router|app)\.(get|post|put|delete|patch)' 40
find . -path ./node_modules -prune -o -name 'test_*.py' -print 2>/dev/null | head -30

sec "12 Documentos de referencia ausentes"
ls ESPECIFICACAO_TECNICA_COLABORACAO_IA_COPILOT_PROTHEUS.md PROJECT_MEMORY.md "Resumo executivo.md" .agents/AGENTS.md AGENTS.md 2>&1
