param(
  [string]$RestUrl = "https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest",
  [string]$WebappUrl = "https://rodolltda195384.protheus.cloudtotvs.com.br:10703/webapp/index.html",
  [string]$VsCodeUrl = "https://rodolltda195384.protheus.cloudtotvs.com.br:10714"
)

Write-Host "REST: $RestUrl"
try { (Invoke-WebRequest -Uri $RestUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }
Write-Host "WEBAPP: $WebappUrl"
try { (Invoke-WebRequest -Uri $WebappUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }
Write-Host "VSCODE: $VsCodeUrl"
try { (Invoke-WebRequest -Uri $VsCodeUrl -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }
