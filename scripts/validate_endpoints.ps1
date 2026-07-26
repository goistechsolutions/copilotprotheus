param(
  [string]$RestUrl = "https://protheus.suaempresa.cloudtotvs.com.br:10707/rest",
  [string]$WebappUrl = "https://protheus.suaempresa.cloudtotvs.com.br:10703/webapp/index.html",
  [string]$VsCodeUrl = "https://protheus.suaempresa.cloudtotvs.com.br:10714"
)

Write-Host "Verificando conectividade REST: $RestUrl"
try { (Invoke-WebRequest -Uri $RestUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }

Write-Host "Verificando conectividade WEBAPP: $WebappUrl"
try { (Invoke-WebRequest -Uri $WebappUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }

Write-Host "Verificando conectividade VSCODE (AppServer / Debug): $VsCodeUrl"
try { (Invoke-WebRequest -Uri $VsCodeUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }
