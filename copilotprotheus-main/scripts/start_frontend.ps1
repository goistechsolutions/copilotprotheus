# Copilot Protheus - Start Frontend
# PowerShell compatível com Windows PowerShell 5.1+

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$FRONTEND_DIR = Join-Path $PROJECT_ROOT "frontend"

Write-Host "Copilot Protheus - Frontend" -ForegroundColor Cyan
Write-Host "Diretorio: $FRONTEND_DIR" -ForegroundColor Gray

Set-Location $FRONTEND_DIR
if (-not (Test-Path (Join-Path $FRONTEND_DIR "node_modules"))) {
    Write-Host "Instalando dependencias do Node..." -ForegroundColor Yellow
    npm install
}

Write-Host "Lancando Vite dev..." -ForegroundColor Cyan
npm run dev
