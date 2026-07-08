$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder "CopilotProtheus.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$(Join-Path $PSScriptRoot 'start_background.vbs')`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "powershell.exe,0"
$Shortcut.Description = "Iniciar Servidores Copilot Protheus em Segundo Plano"
$Shortcut.Save()
Write-Host "Atalho criado na pasta de Inicializacao: $StartupFolder" -ForegroundColor Green
