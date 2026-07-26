$binDir = Join-Path $PSScriptRoot "bin"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

$cloudflaredPath = Join-Path $binDir "cloudflared.exe"
$configPath = "C:\projeto\copilotprotheus\config\tunnel-config.yml"

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Baixando o cloudflared.exe oficial do GitHub..." -ForegroundColor Cyan
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    # Força uso de TLS 1.2 para download do GitHub
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $cloudflaredPath
    Write-Host "Download concluído!" -ForegroundColor Green
}

Write-Host "Iniciando túnel Cloudflare para copilot.elitecorp.tec.br..." -ForegroundColor Yellow
Start-Process -FilePath $cloudflaredPath -ArgumentList "--config", $configPath, "tunnel", "run" -NoNewWindow
