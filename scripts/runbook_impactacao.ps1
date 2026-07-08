# Copilot Protheus - Runbook de Impantacao
# PowerShell compatível com Windows PowerShell 5.1+

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$BACKEND_DIR = Join-Path $PROJECT_ROOT "backend"
$FRONTEND_DIR = Join-Path $PROJECT_ROOT "frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Copilot Protheus - Runbook de Implantacao" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Backend (FastAPI)" -ForegroundColor Yellow
Write-Host "   - Certifique-se de ter Python instalado" -ForegroundColor Gray
Write-Host "   - Edite .env se necessario (PROTHEUS_REST_URL, PROTHEUS_USER, PROTHEUS_PASSWORD)" -ForegroundColor Gray
Write-Host "   - Execute: .\scripts\start_backend.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Frontend (Vite + React)" -ForegroundColor Yellow
Write-Host "   - Certifique-se de ter Node.js instalado" -ForegroundColor Gray
Write-Host "   - Execute: .\scripts\start_frontend.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Protheus REST" -ForegroundColor Yellow
Write-Host "   - Requer configuracao REST no AppServer da homologacao" -ForegroundColor Gray
Write-Host "   - Verificar .ini do AppServer com secoes HTTPV11, HTTPREST, HTTPJOB, ONSTART" -ForegroundColor Gray
Write-Host "   - Reiniciar AppServer apos compilar fontes WSRESTFUL" -ForegroundColor Gray
Write-Host "   - URL padrao: http://localhost:8080/rest" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Validacoes" -ForegroundColor Yellow
Write-Host "   - Backend: http://127.0.0.1:8000/health" -ForegroundColor Gray
Write-Host "   - Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "   - Diagnostico Protheus: http://127.0.0.1:8000/api/diagnostics/protheus" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
