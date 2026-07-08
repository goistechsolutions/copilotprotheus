param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$EnvFile = Join-Path $ProjectRoot "config\pilot.env"
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^(\w+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
  }
}

$BackendDir = Join-Path $ProjectRoot "backend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"
$Script = @'
import os
import requests
from app.core.settings import PROTHEUS_REST_URL, WEBAPP_URL, VSCODE_SERVER_URL, TIMEOUT_SECONDS

for name, url in [('REST', PROTHEUS_REST_URL), ('WEBAPP', WEBAPP_URL), ('VSCODE', VSCODE_SERVER_URL)]:
    try:
        r = requests.get(url, timeout=TIMEOUT_SECONDS, verify=False)
        print(f'{name}: OK {r.status_code}')
    except Exception as e:
        print(f'{name}: FAIL {e}')
'@

Set-Location $BackendDir
$Script | & $PythonExe -
