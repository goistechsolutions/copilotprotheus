# Copilot Protheus — download_model_ovms.ps1
# Baixa modelo OpenVINO INT4 do Hugging Face para uso com OVMS

param(
    [string]$Model     = "llama3",
    [string]$ModelsDir = "C:\modelos_ovms"
)

$HF_MODELS = @{
    "llama3"   = "OpenVINO/Llama-3.1-8B-Instruct-int4-ov"
    "mistral"  = "OpenVINO/mistral-7b-instruct-v0.1-int4-ov"
    "qwen2"    = "OpenVINO/Qwen2.5-7B-Instruct-int4-ov"
    "phi3"     = "OpenVINO/Phi-3-mini-4k-instruct-int4-ov"
}

if (-not $HF_MODELS.ContainsKey($Model)) {
    Write-Host "Modelo desconhecido: $Model" -ForegroundColor Red
    Write-Host "Opcoes: llama3, mistral, qwen2, phi3" -ForegroundColor Yellow
    exit 1
}

$hfRepo  = $HF_MODELS[$Model]
$destDir = Join-Path $ModelsDir $Model

Write-Host ""
Write-Host "=== Download Modelo OpenVINO INT4 ===" -ForegroundColor Cyan
Write-Host "  Modelo HF : $hfRepo"
Write-Host "  Destino   : $destDir"
Write-Host ""

# Verifica huggingface_hub
$hfOk = python -c "import huggingface_hub" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instalando huggingface_hub..." -ForegroundColor Yellow
    pip install huggingface_hub
}

python -c @"
from huggingface_hub import snapshot_download
snapshot_download(repo_id='$hfRepo', local_dir='$destDir')
print('Download concluido: $destDir')
"@

Write-Host ""
Write-Host "Modelo pronto em: $destDir" -ForegroundColor Green
Write-Host "Execute: .\scripts\start_ovms.ps1 -Model $Model" -ForegroundColor Cyan
