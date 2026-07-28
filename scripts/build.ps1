# build.ps1 — build para Windows
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$frontend = Join-Path $root 'admin-frontend'
$dest = Join-Path $root 'backend\app\static\admin'

Write-Host "`n▶ Instalando dependências..." -ForegroundColor Cyan
Set-Location $frontend
npm ci --frozen-lockfile

Write-Host "`n▶ Buildando admin-frontend..." -ForegroundColor Cyan
npm run build

Write-Host "`n▶ Copiando dist → backend\static\admin..." -ForegroundColor Cyan
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item "$frontend\dist\*" -Destination $dest -Recurse

Write-Host "`n✅ Build completo!" -ForegroundColor Green
