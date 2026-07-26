# Copilot Protheus — start_ovms.ps1
# Sobe o OpenVINO Model Server (OVMS) localmente
# Requer Docker Desktop instalado: https://www.docker.com/products/docker-desktop/

param(
    [string]$Model  = "llama3",
    [string]$Port   = "8080",
    [string]$ModelsDir = "C:\modelos_ovms"
)

Write-Host "" 
Write-Host "=== OpenVINO Model Server ===" -ForegroundColor Cyan
Write-Host "  Modelo : $Model"
Write-Host "  Porta  : $Port"
Write-Host "  Pasta  : $ModelsDir"
Write-Host ""

# Criar pasta de modelos se nao existir
if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir | Out-Null
    Write-Host "Pasta criada: $ModelsDir" -ForegroundColor DarkGray
}

# Verificar se Docker esta disponivel
$dockerOk = Get-Command "docker" -ErrorAction SilentlyContinue
if (-not $dockerOk) {
    Write-Host "Docker nao encontrado. Instale em: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

Write-Host "[1/2] Baixando imagem OVMS (pode demorar na primeira vez)..." -ForegroundColor Yellow
docker pull openvino/model_server:latest

Write-Host "[2/2] Subindo OVMS na porta $Port..." -ForegroundColor Yellow
docker run -d --name ovms_copilot `
    -p "${Port}:8080" `
    -v "${ModelsDir}:/models" `
    openvino/model_server:latest `
    --model_name $Model `
    --model_path "/models/$Model" `
    --port 9000 `
    --rest_port 8080

Write-Host ""
Write-Host "OVMS rodando em http://localhost:$Port" -ForegroundColor Green
Write-Host "Modelos: GET http://localhost:$Port/v3/models" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para usar no backend, edite backend\.env:" -ForegroundColor Yellow
Write-Host "  LLM_BACKEND=ovms" -ForegroundColor DarkGray
Write-Host "  OLLAMA_URL=http://127.0.0.1:$Port" -ForegroundColor DarkGray
Write-Host "  OLLAMA_MODEL=$Model" -ForegroundColor DarkGray
