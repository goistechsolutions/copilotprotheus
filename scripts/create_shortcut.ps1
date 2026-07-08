param(
    [string]$WebAgentPath = "C:\Users\muril\AppData\Local\Programs\web-agent\web-agent.exe",
    [string]$BrowserPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $WebAgentPath)) { throw "WebAgent não encontrado em: $WebAgentPath" }
if (!(Test-Path $BrowserPath)) { throw "Browser não encontrado em: $BrowserPath" }

$shortcutPath = Join-Path $PSScriptRoot "Copilot Protheus.lnk"
$targetUrl = "http://127.0.0.1:8000/api/launch"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $BrowserPath
$Shortcut.Arguments = "--new-window $targetUrl"
$Shortcut.WorkingDirectory = Split-Path $BrowserPath
$Shortcut.IconLocation = $BrowserPath
$Shortcut.Save()

Write-Host "Atalho criado em: $shortcutPath"
