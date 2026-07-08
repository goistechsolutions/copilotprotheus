# Copilot Protheus — start_all.ps1
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Copilot Protheus ===" -ForegroundColor Cyan
Write-Host "Raiz: $Root"
Write-Host ""

# ── 1. Ollama ─────────────────────────────────────────────────
Write-Host "[1/4] Verificando Ollama..." -ForegroundColor Yellow
$ollamaPath = Get-Command "ollama" -ErrorAction SilentlyContinue
if ($ollamaPath) {
    $running = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if (-not $running) {
        Start-Process "ollama" -ArgumentList "serve" -WindowStyle Minimized
        Start-Sleep -Seconds 3
        Write-Host "      Ollama iniciado." -ForegroundColor Green
    } else {
        Write-Host "      Ollama ja estava rodando." -ForegroundColor DarkGray
    }
} else {
    Write-Host "      Ollama nao instalado (ignorando)." -ForegroundColor DarkGray
}

# ── 2. Backend FastAPI ────────────────────────────────────────
Write-Host "[2/4] Iniciando Backend FastAPI na porta 8000..." -ForegroundColor Yellow
$backendPath = Join-Path $Root "backend"
$uvicorn     = Join-Path $backendPath "venv\Scripts\uvicorn.exe"

if (-not (Test-Path $uvicorn)) {
    Write-Host "      venv nao encontrado. Executando fix_backend_python312.ps1..." -ForegroundColor Yellow
    & (Join-Path $Root "scripts\fix_backend_python312.ps1")
}

$backendCmd = "Set-Location '$backendPath'; & '.\venv\Scripts\uvicorn.exe' app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Start-Sleep -Seconds 4

# ── 3. Middleware Node.js ─────────────────────────────────────
Write-Host "[3/4] Iniciando Middleware Node.js na porta 3001..." -ForegroundColor Yellow
$middlewarePath = Join-Path $Root "middleware"
if (-not (Test-Path (Join-Path $middlewarePath "node_modules"))) {
    Push-Location $middlewarePath; npm install; Pop-Location
}
$middlewareCmd = "Set-Location '$middlewarePath'; npm run dev"
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", $middlewareCmd -WindowStyle Normal
Start-Sleep -Seconds 2

# ── 4. Frontend React ─────────────────────────────────────────
Write-Host "[4/4] Iniciando Frontend React na porta 5173..." -ForegroundColor Yellow
$frontendPath = Join-Path $Root "frontend"
if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Push-Location $frontendPath; npm install; Pop-Location
}
$frontendCmd = "Set-Location '$frontendPath'; npm run dev"
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
Start-Sleep -Seconds 3

# ── Resumo ────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Ambiente pronto! ===" -ForegroundColor Green
Write-Host "  Frontend  : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Middleware: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Backend   : http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Ollama    : http://localhost:11434" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Verificar:" -ForegroundColor Yellow
Write-Host "  Invoke-RestMethod http://localhost:8000/health" -ForegroundColor DarkGray
Write-Host "  Invoke-RestMethod http://localhost:3001/health" -ForegroundColor DarkGray
Write-Host ""
