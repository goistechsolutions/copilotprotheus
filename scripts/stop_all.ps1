# Copilot Protheus — stop_all.ps1
Write-Host "Encerrando servicos..." -ForegroundColor Yellow

Get-Process -Name "node"    -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "python"  -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Servicos encerrados." -ForegroundColor Green
