# Copilot Protheus — setup.ps1
# Executar UMA vez antes do start_all.ps1

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Setup inicial ===" -ForegroundColor Cyan

# Backend Python
Write-Host "[1/3] Configurando Backend Python..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "backend")
python -m venv venv
& ".\venv\Scripts\Activate.ps1"
pip install -r requirements.txt
Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
Set-Location $Root

# Middleware
Write-Host "[2/3] Instalando dependencias do Middleware..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "middleware")
npm install
Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
Set-Location $Root

# Frontend
Write-Host "[3/3] Instalando dependencias do Frontend..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "frontend")
npm install
Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
Set-Location $Root

# Ollama model
Write-Host "Baixando modelo Ollama (llama3)..." -ForegroundColor Yellow
ollama pull llama3

Write-Host ""
Write-Host "Setup concluido! Execute: .\scripts\start_all.ps1" -ForegroundColor Green
