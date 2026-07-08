# Script de Inicialização Automática e Supervisor do Copilot Protheus
# Uso: 
#   .\scripts\startup_agent.ps1            (Inicia os serviços)
#   .\scripts\startup_agent.ps1 -Register  (Registra na inicialização do Windows via Agendador de Tarefas)
#   .\scripts\startup_agent.ps1 -Unregister (Remove da inicialização)

param (
    [switch]$Register,
    [switch]$Unregister,
    [string]$Mode = "docker" # Opções: "docker" ou "native"
)

$ProjectRoot = "C:\projeto\copilotprotheus"
$LogPath = "$ProjectRoot\logs\startup_agent.log"

# Garante a existência do diretório de logs
if (-not (Test-Path "$ProjectRoot\logs")) {
    New-Item -ItemType Directory -Path "$ProjectRoot\logs" | Out-Null
}

function Write-Log {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] $message"
    Write-Host $logLine
    Add-Content -Path $LogPath -Value $logLine
}

# 1. Registro no Agendador de Tarefas do Windows (Startup Automatizado)
if ($Register) {
    Write-Log "Registrando o Copilot Protheus no Agendador de Tarefas do Windows..."
    
    $Action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument "-WindowStyle Hidden -File $ProjectRoot\scripts\startup_agent.ps1 -Mode $Mode"
    # Dispara ao fazer Logon de qualquer usuário
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    
    # Registra a tarefa com privilégios elevados para garantir execução silenciosa em background
    Register-ScheduledTask -TaskName "CopilotProtheusStartup" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Inicialização automática em background do Copilot Protheus" -Force
    
    Write-Log "Tarefa 'CopilotProtheusStartup' registrada com sucesso! Ela executará silenciosamente a cada login."
    exit
}

if ($Unregister) {
    Write-Log "Removendo a tarefa de inicialização do Agendador de Tarefas..."
    Unregister-ScheduledTask -TaskName "CopilotProtheusStartup" -Confirm:$false
    Write-Log "Tarefa de inicialização removida!"
    exit
}

# 2. Inicialização dos Serviços
Write-Log "Iniciando a pilha de serviços do Copilot Protheus (Modo: $Mode)..."

if ($Mode -eq "docker") {
    # Inicialização via Docker Compose
    Write-Log "Verificando se o serviço do Docker está rodando..."
    $dockerCheck = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerCheck) {
        Write-Log "Docker Desktop não encontrado em execução. Iniciando..."
        Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Minimized
        # Aguarda o motor do Docker inicializar
        Start-Sleep -Seconds 15
    }

    Write-Log "Subindo containers via Docker Compose..."
    Start-Process -FilePath "docker-compose" -ArgumentList "up", "-d" -WorkingDirectory $ProjectRoot -NoNewWindow -Wait
    Write-Log "Containers do Docker subiram com sucesso."

} else {
    # Inicialização Nativa Local (Sem Docker)
    Write-Log "Iniciando Banco de Dados PostgreSQL Local..."
    Start-Service -Name "postgresql*" -ErrorAction SilentlyContinue

    Write-Log "Iniciando Backend FastAPI..."
    Start-Process -FilePath "$ProjectRoot\backend\venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory "$ProjectRoot\backend" -WindowStyle Hidden

    Write-Log "Iniciando Middleware Express..."
    Start-Process -FilePath "node" -ArgumentList "src/routes/chat.js" -WorkingDirectory "$ProjectRoot\middleware" -WindowStyle Hidden

    Write-Log "Iniciando Frontend React..."
    Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$ProjectRoot\frontend" -WindowStyle Hidden
}

# 3. Inicialização do Túnel Cloudflare
Write-Log "Verificando executável do cloudflared..."
$cloudflaredPath = "$ProjectRoot\scripts\bin\cloudflared.exe"
$configPath = "$ProjectRoot\config\tunnel-config.yml"

if (Test-Path $cloudflaredPath) {
    Write-Log "Iniciando Túnel Cloudflare..."
    Start-Process -FilePath $cloudflaredPath -ArgumentList "--config", $configPath, "tunnel", "run" -WindowStyle Hidden
    Write-Log "Túnel Cloudflare iniciado em background."
} else {
    Write-Log "ATENÇÃO: cloudflared.exe não encontrado em $cloudflaredPath. Execute o script start_tunnel.ps1 para baixá-lo."
}

Write-Log "Todos os serviços foram inicializados com sucesso em background!"
