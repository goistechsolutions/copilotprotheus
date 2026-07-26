param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$BackendDir = Join-Path $ProjectRoot "backend"
$VenvDir = Join-Path $BackendDir "venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$PipExe = Join-Path $VenvDir "Scripts\pip.exe"
$ReqFile = Join-Path $BackendDir "requirements.txt"

if (-not (Test-Path $VenvDir)) {
  python -m venv $VenvDir
}

& $PythonExe -m pip install --upgrade pip
& $PipExe install -r $ReqFile
