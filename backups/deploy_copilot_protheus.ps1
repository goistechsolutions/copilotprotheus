# =============================================================================
# deploy_copilot_protheus.ps1
# Deploy automatico das correcoes do Copilot Protheus
# Execucao: .\deploy_copilot_protheus.ps1 -ProjetoPath "C:\projeto\copilotprotheus"
# =============================================================================
param(
  [string]$ProjetoPath = "C:\projeto\copilotprotheus"
)

$ErrorActionPreference = "Stop"
$DEPLOY_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG = Join-Path $DEPLOY_DIR "deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$BACKUP = Join-Path $ProjetoPath "_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

function Log($msg) {
  $ts = Get-Date -Format "HH:mm:ss"
  $line = "[$ts] $msg"
  Write-Host $line
  Add-Content -Path $LOG -Value $line
}

function CopyFile($src, $dst) {
  $dstDir = Split-Path -Parent $dst
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  if (Test-Path $dst) {
    $bak = $dst -replace [regex]::Escape($ProjetoPath), $BACKUP
    $bakDir = Split-Path -Parent $bak
    if (!(Test-Path $bakDir)) { New-Item -ItemType Directory -Force -Path $bakDir | Out-Null }
    Copy-Item -Path $dst -Destination $bak -Force
    Log "  BACKUP  $dst -> $bak"
  }
  Copy-Item -Path $src -Destination $dst -Force
  Log "  COPIADO $dst"
}

# ── Validacao inicial ──────────────────────────────────────────────────────────
Log "========================================================"
Log " Copilot Protheus — Deploy de Correcoes"
Log " Destino : $ProjetoPath"
Log "========================================================"

if (!(Test-Path $ProjetoPath)) {
  Log "ERRO: Pasta do projeto nao encontrada: $ProjetoPath"
  exit 1
}

# ── Passo 1: JWT ──────────────────────────────────────────────────────────────
Log ""
Log "[1/8] JWT — middleware/auth/jwtMiddleware.js"
CopyFile "$DEPLOY_DIR\middleware\auth\jwtMiddleware.js" "$ProjetoPath\middleware\auth\jwtMiddleware.js"

# ── Passo 2: Cache ────────────────────────────────────────────────────────────
Log ""
Log "[2/8] Cache — middleware/cache/cacheService.js"
CopyFile "$DEPLOY_DIR\middleware\cache\cacheService.js" "$ProjetoPath\middleware\cache\cacheService.js"

# ── Passo 3: Enricher com Promise.all ────────────────────────────────────────
Log ""
Log "[3/8] Enricher paralelismo — middleware/protheusEnricher.js"
CopyFile "$DEPLOY_DIR\middleware\protheusEnricher.js" "$ProjetoPath\middleware\protheusEnricher.js"

# ── Passo 4: IntentClassifier com fallback LLM ────────────────────────────────
Log ""
Log "[4/8] IntentClassifier — middleware/intentClassifier.js"
CopyFile "$DEPLOY_DIR\middleware\intentClassifier.js" "$ProjetoPath\middleware\intentClassifier.js"

# ── Passo 5: Backend audit_service ────────────────────────────────────────────
Log ""
Log "[5/8] Audit Service — backend/audit_service.py"
CopyFile "$DEPLOY_DIR\backend\audit_service.py" "$ProjetoPath\backend\audit_service.py"

# ── Passo 6: Backend assistant_service ────────────────────────────────────────
Log ""
Log "[6/8] Assistant Service — backend/assistant_service.py"
CopyFile "$DEPLOY_DIR\backend\assistant_service.py" "$ProjetoPath\backend\assistant_service.py"

# ── Passo 7: sql_service sem SELECT * ─────────────────────────────────────────
Log ""
Log "[7/8] SQL Service — backend/sql_service.py"
CopyFile "$DEPLOY_DIR\backend\sql_service.py" "$ProjetoPath\backend\sql_service.py"

# ── Passo 8: ADVPL SC6 + Paginacao ────────────────────────────────────────────
Log ""
Log "[8/8] ADVPL — advpl_apis_sc6.prw + advpl_paginacao_sc5.prw"
CopyFile "$DEPLOY_DIR\advpl\advpl_apis_sc6.prw"     "$ProjetoPath\advpl\advpl_apis_sc6.prw"
CopyFile "$DEPLOY_DIR\advpl\advpl_paginacao_sc5.prw" "$ProjetoPath\advpl\advpl_paginacao_sc5.prw"

# ── SQL Patch ─────────────────────────────────────────────────────────────────
Log ""
Log "[INFO] Schema SQL copiado para: $ProjetoPath\db\schema_patch.sql"
CopyFile "$DEPLOY_DIR\db\schema_patch.sql" "$ProjetoPath\db\schema_patch.sql"
Log "[INFO] Execute manualmente no PostgreSQL: psql -d copilot_protheus -f db\schema_patch.sql"

# ── npm install ────────────────────────────────────────────────────────────────
Log ""
Log "[DEP] Instalando dependencias Node.js..."
Push-Location "$ProjetoPath\middleware"
try {
  npm install jsonwebtoken node-cache --save 2>&1 | Tee-Object -Append $LOG
  Log "[DEP] npm install concluido."
} catch {
  Log "[AVISO] npm install falhou: $_  (execute manualmente)"
} finally {
  Pop-Location
}

# ── pip install ────────────────────────────────────────────────────────────────
Log ""
Log "[DEP] Instalando dependencias Python..."
Push-Location "$ProjetoPath\backend"
try {
  pip install asyncpg 2>&1 | Tee-Object -Append $LOG
  Log "[DEP] pip install concluido."
} catch {
  Log "[AVISO] pip install falhou: $_  (execute manualmente)"
} finally {
  Pop-Location
}

# ── Verificacao .env ──────────────────────────────────────────────────────────
Log ""
$envFile = "$ProjetoPath\middleware\.env"
if (Test-Path $envFile) {
  $envContent = Get-Content $envFile
  if (!($envContent -match "JWT_SECRET")) {
    Log "[ENV] Adicionando JWT_SECRET ao .env do middleware..."
    Add-Content -Path $envFile -Value "`nJWT_SECRET=copilot_protheus_secret_CHANGE_IN_PROD"
    Log "[ENV] JWT_SECRET adicionado. IMPORTANTE: altere o valor antes de ir para producao!"
  } else {
    Log "[ENV] JWT_SECRET ja existe no .env — sem alteracoes."
  }
  if (!($envContent -match "DATABASE_URL")) {
    Log "[ENV] Adicionando DATABASE_URL ao .env do middleware..."
    Add-Content -Path $envFile -Value "`nDATABASE_URL=postgresql://user:password@localhost:5432/copilot_protheus"
    Log "[ENV] DATABASE_URL adicionado. IMPORTANTE: ajuste as credenciais reais."
  }
} else {
  Log "[AVISO] .env nao encontrado em $envFile — configure manualmente:"
  Log "  JWT_SECRET=copilot_protheus_secret_CHANGE_IN_PROD"
  Log "  DATABASE_URL=postgresql://user:password@localhost:5432/copilot_protheus"
}

# ── Relatorio final ────────────────────────────────────────────────────────────
Log ""
Log "========================================================"
Log " DEPLOY CONCLUIDO"
Log " Backups salvos em: $BACKUP"
Log " Log completo    : $LOG"
Log "========================================================"
Log ""
Log " PROXIMOS PASSOS MANUAIS:"
Log "  1. Ajuste JWT_SECRET no .env do middleware (valor seguro)"
Log "  2. Ajuste DATABASE_URL no .env do backend"
Log "  3. Execute: psql -d copilot_protheus -f $ProjetoPath\db\schema_patch.sql"
Log "  4. Adicione protecao JWT em server.js (veja server.patch.js)"
Log "  5. Compile e publique os fontes ADVPL no Protheus REST Server"
Log "     - advpl_apis_sc6.prw"
Log "     - advpl_paginacao_sc5.prw (aplicar padrao em SE1, SB2, SC7)"
Log "  6. Reinicie middleware e backend"
Log "========================================================"
