# Copilot Protheus — fix_backend_python312.ps1 v2
# Corrige Python 3.14 incompativel com pydantic_core

$Root        = Split-Path -Parent $PSScriptRoot
$BackendPath = Join-Path $Root "backend"
$VenvPath    = Join-Path $BackendPath "venv"

Write-Host ""
Write-Host "=== Copilot Protheus - Fix Python 3.12 ===" -ForegroundColor Cyan
Write-Host ""

# 1. Matar processos que travam o venv
Write-Host "[1/5] Encerrando processos que bloqueiam o venv..." -ForegroundColor Yellow
$nomes = @("python","uvicorn","fastapi")
foreach ($n in $nomes) {
    $procs = Get-Process -Name $n -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force
        Write-Host "      Encerrado: $n" -ForegroundColor DarkGray
    }
}
Start-Sleep -Seconds 2

# Forcar liberacao de handles com robocopy (truque Windows)
if (Test-Path $VenvPath) {
    Write-Host "      Forcando liberacao de handles..." -ForegroundColor DarkGray
    $emptyDir = Join-Path $env:TEMP "empty_dir_cprot"
    New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
    robocopy $emptyDir $VenvPath /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Remove-Item $emptyDir -Force -Recurse -ErrorAction SilentlyContinue
    Remove-Item $VenvPath -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $VenvPath) {
        Write-Host "      AVISO: venv ainda existe - tentando cmd /c rd..." -ForegroundColor Yellow
        cmd /c "rd /s /q `"$VenvPath`""
    }
}

if (Test-Path $VenvPath) {
    Write-Host "      ERRO: nao foi possivel remover o venv." -ForegroundColor Red
    Write-Host "      Feche todas as janelas do PowerShell/terminal que usam o backend e rode novamente." -ForegroundColor Yellow
    exit 1
}
Write-Host "      venv antigo removido." -ForegroundColor Green

# 2. Confirmar Python 3.12
Write-Host "[2/5] Verificando Python 3.12..." -ForegroundColor Yellow
$py312 = $null
try {
    $v = & py -3.12 --version 2>&1
    if ($v -match "3\.12") { $py312 = "py -3.12" }
} catch {}
foreach ($c in @(
    "C:\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
)) {
    if (!$py312 -and (Test-Path $c)) { $py312 = $c }
}
if (!$py312) {
    Write-Host "      Python 3.12 nao encontrado." -ForegroundColor Red
    Write-Host "      Baixe em: https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -ForegroundColor Yellow
    Write-Host "      Instale marcando ADD TO PATH e rode este script novamente." -ForegroundColor Yellow
    exit 1
}
Write-Host "      Python 3.12 encontrado: $py312" -ForegroundColor Green

# 3. Criar novo venv
Write-Host "[3/5] Criando venv com Python 3.12..." -ForegroundColor Yellow
Set-Location $BackendPath
if ($py312 -eq "py -3.12") {
    & py -3.12 -m venv venv
} else {
    & $py312 -m venv venv
}
Start-Sleep -Seconds 2

$pip     = Join-Path $VenvPath "Scripts\pip.exe"
$python  = Join-Path $VenvPath "Scripts\python.exe"
$uvicorn = Join-Path $VenvPath "Scripts\uvicorn.exe"

if (!(Test-Path $pip)) {
    Write-Host "      ERRO: pip nao encontrado no venv." -ForegroundColor Red
    exit 1
}
Write-Host "      venv criado." -ForegroundColor Green

# 4. Instalar dependencias
Write-Host "[4/5] Instalando dependencias..." -ForegroundColor Yellow
& $pip install --upgrade pip --quiet
& $pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERRO na instalacao." -ForegroundColor Red
    exit 1
}
Write-Host "      Dependencias instaladas." -ForegroundColor Green

# 5. Validar
Write-Host "[5/5] Validando instalacao..." -ForegroundColor Yellow
$pyver  = & $python --version 2>&1
$pydver = & $python -c "import pydantic; print(pydantic.__version__)" 2>&1
$faver  = & $python -c "import fastapi; print(fastapi.__version__)" 2>&1

Write-Host "      Python  : $pyver"  -ForegroundColor Cyan
Write-Host "      Pydantic: $pydver" -ForegroundColor Cyan
Write-Host "      FastAPI : $faver"  -ForegroundColor Cyan

if ($pyver -match "3\.12" -and $faver -notmatch "Error") {
    Write-Host ""
    Write-Host "=== Correcao concluida com sucesso! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Suba o backend:" -ForegroundColor Yellow
    Write-Host "  cd $Root" -ForegroundColor DarkGray
    Write-Host "  .\scripts\start_all.ps1" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Ou manualmente:" -ForegroundColor Yellow
    Write-Host "  cd $BackendPath" -ForegroundColor DarkGray
    Write-Host "  .\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor DarkGray
} else {
    Write-Host "      AVISO: validacao falhou. Verifique os erros acima." -ForegroundColor Red
}
