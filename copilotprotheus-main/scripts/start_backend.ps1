# Copilot Protheus - Start Backend
# PowerShell compatível com Windows PowerShell 5.1+

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$BACKEND_DIR = Join-Path $PROJECT_ROOT "backend"
$REQ_FILE = Join-Path $BACKEND_DIR "requirements.txt"
$PYTHON_EXE = Join-Path $BACKEND_DIR "venv\Scripts\python.exe"
$PIP_EXE = Join-Path $BACKEND_DIR "venv\Scripts\pip.exe"

Write-Host "Copilot Protheus - Backend" -ForegroundColor Cyan
Write-Host "Diretorio: $BACKEND_DIR" -ForegroundColor Gray

if (-not (Test-Path (Join-Path $BACKEND_DIR "venv"))) {
    Write-Host "Criando ambiente virtual Python..." -ForegroundColor Yellow
    python -m venv (Join-Path $BACKEND_DIR "venv")
}

if (-not (Test-Path $REQ_FILE)) {
    Write-Host "ERRO: requirements.txt nao encontrado em $REQ_FILE" -ForegroundColor Red
    Write-Host "Copie o arquivo requirements.txt para a pasta backend antes de continuar." -ForegroundColor Yellow
    exit 1
}

Write-Host "Instalando dependencias Python..." -ForegroundColor Yellow
& $PYTHON_EXE -m pip install --upgrade pip
& $PIP_EXE install -r $REQ_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: falha na instalacao das dependencias." -ForegroundColor Red
    exit 1
}

Write-Host "Validando uvicorn..." -ForegroundColor Yellow
& $PYTHON_EXE -m pip show uvicorn | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Uvicorn nao encontrado. Instalando manualmente..." -ForegroundColor Yellow
    & $PIP_EXE install uvicorn[standard]
}

Write-Host "Criando .env do .env.example..." -ForegroundColor Yellow
$envExample = Join-Path $BACKEND_DIR ".env.example"
$envFile = Join-Path $BACKEND_DIR ".env"
if ((Test-Path $envExample) -and (-not (Test-Path $envFile))) {
    Copy-Item $envExample $envFile
    Write-Host ".env.example copiado -> .env (edite se necessario)" -ForegroundColor Gray
}

Set-Location $BACKEND_DIR
Write-Host "Lancando API FastAPI..." -ForegroundColor Cyan
& $PYTHON_EXE -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
