#requires -Version 5.1
<#
.SYNOPSIS
  Benchmark local de LLMs via API do Ollama.
.DESCRIPTION
  Executa aquecimento e repeticoes para varios modelos e casos de teste.
  Registra latencia, tokens/s, processamento do prompt, RAM/CPU do Ollama e,
  quando disponivel, contadores de GPU do Windows. Exporta CSV, JSON e respostas.

.EXAMPLE
  .\benchmark-llm.ps1
.EXAMPLE
  .\benchmark-llm.ps1 -Models "qwen2.5-coder:3b","qwen2.5-coder:7b" -Repetitions 3
.EXAMPLE
  .\benchmark-llm.ps1 -Models "qwen2.5-coder:3b" -SkipGpuMonitoring
#>
[CmdletBinding()]
param(
    [string[]]$Models = @("qwen2.5-coder:3b", "qwen2.5-coder:7b"),
    [string]$OllamaBaseUrl = "http://localhost:11434",
    [ValidateRange(1, 20)][int]$Repetitions = 3,
    [ValidateRange(0, 5)][int]$WarmupRuns = 1,
    [ValidateRange(128, 32768)][int]$NumPredict = 512,
    [ValidateRange(256, 131072)][int]$NumCtx = 4096,
    [ValidateRange(0.0, 2.0)][double]$Temperature = 0.0,
    [ValidateRange(100, 10000)][int]$MonitorIntervalMs = 500,
    [ValidateRange(10, 7200)][int]$TimeoutSeconds = 600,
    [string]$OutputDirectory = ".\benchmark-llm-resultados",
    [switch]$SkipGpuMonitoring,
    [switch]$UnloadBetweenModels
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Convert-NsToSeconds([object]$Value) {
    if ($null -eq $Value) { return 0.0 }
    return [math]::Round(([double]$Value / 1e9), 4)
}

function Get-SafeRate([object]$Count, [object]$DurationNs) {
    if ($null -eq $Count -or $null -eq $DurationNs -or [double]$DurationNs -le 0) { return 0.0 }
    return [math]::Round(([double]$Count / ([double]$DurationNs / 1e9)), 2)
}

function Get-Percentile([double[]]$Values, [double]$Percentile) {
    if (-not $Values -or $Values.Count -eq 0) { return 0.0 }
    $sorted = @($Values | Sort-Object)
    $index = [math]::Ceiling(($Percentile / 100.0) * $sorted.Count) - 1
    $index = [math]::Max(0, [math]::Min($index, $sorted.Count - 1))
    return [math]::Round($sorted[$index], 2)
}

function Test-OllamaApi {
    try {
        $null = Invoke-RestMethod -Uri "$OllamaBaseUrl/api/tags" -Method Get -TimeoutSec 10
        return $true
    } catch { return $false }
}

function Get-InstalledModelNames {
    try {
        $response = Invoke-RestMethod -Uri "$OllamaBaseUrl/api/tags" -Method Get -TimeoutSec 15
        return @($response.models | ForEach-Object { $_.name })
    } catch { return @() }
}

function Get-GpuCounterPaths {
    if ($SkipGpuMonitoring -or $env:OS -ne "Windows_NT") { return @() }
    try {
        $sets = @(Get-Counter -ListSet * -ErrorAction Stop | Where-Object {
            $_.CounterSetName -match "GPU" -and $_.CounterSetName -match "Engine"
        })
        foreach ($set in $sets) {
            $paths = @($set.PathsWithInstances | Where-Object {
                $_ -match "Utilization|Utiliza|Uso|Percentage|Percentual|%"
            })
            if ($paths.Count -gt 0) { return $paths }
        }
    } catch {
        Write-Warning "Contadores de GPU indisponiveis: $($_.Exception.Message)"
    }
    return @()
}

function Start-ResourceMonitor([string]$CsvPath, [string[]]$GpuPaths) {
    $escapedPath = $CsvPath
    return Start-Job -ScriptBlock {
        param($Path, $IntervalMs, $Paths)
        while ($true) {
            $now = Get-Date
            $proc = @(Get-Process -Name "ollama*" -ErrorAction SilentlyContinue)
            $ramMb = if ($proc.Count) { [math]::Round((($proc | Measure-Object WorkingSet64 -Sum).Sum / 1MB), 2) } else { 0 }
            $cpuSec = if ($proc.Count) { [math]::Round((($proc | Measure-Object CPU -Sum).Sum), 3) } else { 0 }
            $availMb = 0
            try { $availMb = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 2) } catch {}
            $gpuMax = $null
            if ($Paths -and $Paths.Count -gt 0) {
                try {
                    $samples = (Get-Counter -Counter $Paths -ErrorAction Stop).CounterSamples
                    $valid = @($samples | Where-Object { $_.CookedValue -ge 0 -and $_.CookedValue -le 100 })
                    if ($valid.Count) { $gpuMax = [math]::Round(($valid | Measure-Object CookedValue -Maximum).Maximum, 2) }
                } catch {}
            }
            [pscustomobject]@{
                Timestamp = $now.ToString("o")
                OllamaRAM_MB = $ramMb
                OllamaCPU_Total_s = $cpuSec
                RAMDisponivel_MB = $availMb
                GPU_Max_Pct = $gpuMax
            }
            Start-Sleep -Milliseconds $IntervalMs
        }
    } -ArgumentList $escapedPath, $MonitorIntervalMs, $GpuPaths
}

function Stop-ResourceMonitor($Job, [string]$CsvPath) {
    if ($null -eq $Job) { return @() }
    Stop-Job -Job $Job -ErrorAction SilentlyContinue
    $samples = @(Receive-Job -Job $Job -ErrorAction SilentlyContinue)
    Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue
    if ($samples.Count) { $samples | Export-Csv -Path $CsvPath -NoTypeInformation -Encoding UTF8 }
    return $samples
}

function Test-ProtheusCompliance([string]$Sql, [string]$Category) {
    if ($Category -ne "SQL") { return $true }
    if ([string]::IsNullOrWhiteSpace($Sql)) { return $false }
    $upper = $Sql.ToUpper()
    
    # Regras Obrigatorias do Copilot Protheus Oracle:
    # 1. NUNCA usar TOP ou LIMIT
    if ($upper -match "\bSELECT\s+TOP\b" -or $upper -match "\bLIMIT\s+\d+") { return $false }
    # 2. Sempre filtrar D_E_L_E_T_
    if ($upper -notmatch "D_E_L_E_T_") { return $false }
    # 3. NUNCA usar F2_TES (campo inexistente na SF2)
    if ($upper -match "\b(?:[A-Z0-9_]+\.)?F2_TES\b") { return $false }
    # 4. NUNCA usar EXTRACT() em datas Protheus VARCHAR2(8)
    if ($upper -match "\bEXTRACT\s*\(") { return $false }

    return $true
}

function Invoke-OllamaGenerate([string]$Model, [string]$Prompt, [bool]$IsWarmup) {
    $payload = @{
        model = $Model
        prompt = $Prompt
        stream = $false
        keep_alive = "10m"
        options = @{
            temperature = $Temperature
            num_predict = $NumPredict
            num_ctx = $NumCtx
            seed = 42
        }
    }
    $json = $payload | ConvertTo-Json -Depth 8
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri "$OllamaBaseUrl/api/generate" -Method Post `
            -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($json)) `
            -TimeoutSec $TimeoutSeconds
        $sw.Stop()
        return [pscustomobject]@{ Success = $true; Response = $response; WallSeconds = $sw.Elapsed.TotalSeconds; Error = $null }
    } catch {
        $sw.Stop()
        return [pscustomobject]@{ Success = $false; Response = $null; WallSeconds = $sw.Elapsed.TotalSeconds; Error = $_.Exception.Message }
    }
}

# Casos de Teste Reais do Copilot Protheus (Banco ORACLE, TOTVS Cloud)
$TestCases = @(
    [pscustomobject]@{
        Id = "vendas_vendedor_mes_atual"
        Category = "SQL"
        Prompt = @"
Você é o Copilot Protheus SQL Generator especialista em banco de dados ORACLE.
Retorne EXCLUSIVAMENTE uma instrução SELECT válida, sem Markdown, sem explicações.
DIRETRIZES ORACLE PROTHEUS:
- Tabelas: SF2010 SF2 (F2_DOC, F2_VALBRUT, F2_VEND1, F2_EMISSAO, F2_TIPO) e SA3010 SA3 (A3_COD, A3_NOME).
- Relacionamento: SF2.F2_VEND1 = SA3.A3_COD.
- Filtro de exclusão lógica obrigatório: SF2.D_E_L_E_T_ <> '*' AND SA3.D_E_L_E_T_ <> '*'.
- Filtro de notas normais: SF2.F2_TIPO = 'N'. (A tabela SF2 NÃO POSSUI campo de TES, nunca use F2_TES).
- Filtro de mês atual: SUBSTR(SF2.F2_EMISSAO, 1, 6) = TO_CHAR(SYSDATE, 'YYYYMM').
- NUNCA use SELECT TOP nem LIMIT.
TAREFA: Liste o faturamento acumulado do mês atual agrupado por vendedor (código e nome), com total faturado (SUM(SF2.F2_VALBRUT) AS VALOR_TOTAL) e quantidade de pedidos (COUNT(DISTINCT SF2.F2_DOC) AS QTD_PEDIDOS), ordenado pelo maior faturamento.
"@
    },
    [pscustomobject]@{
        Id = "clientes_inativos_90dias"
        Category = "SQL"
        Prompt = @"
Você é o Copilot Protheus SQL Generator especialista em banco de dados ORACLE.
Retorne EXCLUSIVAMENTE uma instrução SELECT válida, sem Markdown, sem explicações.
DIRETRIZES ORACLE PROTHEUS:
- Tabelas: SF2010 SF2 (F2_CLIENTE, F2_LOJA, F2_VEND1, F2_EMISSAO, F2_VALBRUT, F2_DOC, F2_TIPO) e SA1010 SA1 (A1_COD, A1_LOJA, A1_NOME, A1_MUN, A1_EST).
- Relacionamento: SF2.F2_CLIENTE = SA1.A1_COD AND SF2.F2_LOJA = SA1.A1_LOJA.
- Filtros no WHERE: SF2.D_E_L_E_T_ <> '*' AND SA1.D_E_L_E_T_ <> '*' AND SF2.F2_TIPO = 'N' AND SF2.F2_VEND1 = '01'.
- Inatividade no HAVING: HAVING MAX(SF2.F2_EMISSAO) <= TO_CHAR(SYSDATE - 90, 'YYYYMMDD').
- NUNCA use o campo SA1.A1_ULTCOM e NUNCA adicione filtro de mês atual em clientes inativos.
TAREFA: Liste os clientes do vendedor 01 com última venda há mais de 90 dias. Projete código, loja, nome do cliente, município, UF, MAX(SF2.F2_EMISSAO) AS DATA_ULTIMA_COMPRA, ROUND(SYSDATE - TO_DATE(MAX(SF2.F2_EMISSAO), 'YYYYMMDD')) AS DIAS_INATIVO e SUM(SF2.F2_VALBRUT) AS VALOR_HISTORICO.
"@
    },
    [pscustomobject]@{
        Id = "contas_receber_vencidos"
        Category = "SQL"
        Prompt = @"
Você é o Copilot Protheus SQL Generator especialista em banco de dados ORACLE.
Retorne EXCLUSIVAMENTE uma instrução SELECT válida, sem Markdown, sem explicações.
DIRETRIZES ORACLE PROTHEUS:
- Tabela: SE1010 SE1 (E1_NUM, E1_PREFIXO, E1_PARCELA, E1_CLIENTE, E1_NOMCLI, E1_VENCTO, E1_SALDO).
- Filtros no WHERE: SE1.D_E_L_E_T_ <> '*' AND SE1.E1_SALDO > 0 AND SE1.E1_VENCTO < TO_CHAR(SYSDATE, 'YYYYMMDD').
- Limite Oracle: use FETCH FIRST 10 ROWS ONLY (NUNCA use SELECT TOP nem LIMIT).
TAREFA: Liste os 10 maiores títulos vencidos a receber em aberto ordenados pelo maior saldo devedor (E1_SALDO DESC).
"@
    },
    [pscustomobject]@{
        Id = "relatorio_executivo_comercial"
        Category = "Relatorio"
        Prompt = @"
Você é o Copilot Protheus Assistente Executivo de Negócios. Produza um resumo executivo claro e conciso em português do Brasil com base nos dados reais abaixo.
DADOS DA CARTEIRA DO VENDEDOR 01:
- Faturamento Atual: R$ 385.400,00 (Meta do mês: R$ 350.000,00 - 110,1% da meta atingida).
- Clientes Ativos atendidos no mês: 34 clientes (Ticket Médio: R$ 11.335,29).
- Carteira de Clientes Inativos (> 90 dias sem compras): 18 clientes, representando R$ 820.000,00 em histórico de faturamento em risco.
- Maior cliente inativo prioritário: Metalúrgica Progresso Ltda (R$ 145.000,00 histórico, sem compras há 142 dias).
ESTRUTURA DA RESPOSTA:
1. Resumo Executivo da Performance (pontos fortes).
2. Diagnóstico de Riscos (clientes inativos e receita em risco).
3. Duas Ações Comerciais Recomendadas para reativação imediata.
"@
    }
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutputDirectory $timestamp
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$results = [System.Collections.Generic.List[object]]::new()
$responsesDir = Join-Path $runDir "respostas"
New-Item -ItemType Directory -Path $responsesDir -Force | Out-Null

Write-Host "Benchmark LLM via Ollama" -ForegroundColor Cyan
Write-Host "Saida: $runDir"
if (-not (Test-OllamaApi)) { throw "API do Ollama nao acessivel em $OllamaBaseUrl. Inicie o Ollama e tente novamente." }

$installed = @(Get-InstalledModelNames)
foreach ($model in $Models) {
    if ($installed -notcontains $model) {
        Write-Warning "Modelo '$model' nao aparece em /api/tags. Instale-o com: ollama pull $model"
    }
}
$gpuPaths = @(Get-GpuCounterPaths)
if ($gpuPaths.Count) { Write-Host "Monitoramento de GPU: habilitado ($($gpuPaths.Count) contadores)." -ForegroundColor Green }
else { Write-Host "Monitoramento de GPU: indisponivel ou desabilitado; CPU e RAM continuarao sendo medidos." -ForegroundColor Yellow }

$metadata = [ordered]@{
    StartedAt = (Get-Date).ToString("o")
    Computer = $env:COMPUTERNAME
    PowerShell = $PSVersionTable.PSVersion.ToString()
    Models = $Models
    Repetitions = $Repetitions
    WarmupRuns = $WarmupRuns
    NumPredict = $NumPredict
    NumCtx = $NumCtx
    Temperature = $Temperature
    OllamaBaseUrl = $OllamaBaseUrl
}
$metadata | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runDir "configuracao.json") -Encoding UTF8

foreach ($model in $Models) {
    Write-Host "`nModelo: $model" -ForegroundColor Cyan
    for ($w = 1; $w -le $WarmupRuns; $w++) {
        Write-Host "  Aquecimento $w/$WarmupRuns..." -NoNewline
        $warm = Invoke-OllamaGenerate -Model $model -Prompt "Responda apenas: pronto" -IsWarmup $true
        if ($warm.Success) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " FALHOU: $($warm.Error)" -ForegroundColor Red }
    }

    foreach ($test in $TestCases) {
        for ($run = 1; $run -le $Repetitions; $run++) {
            Write-Host "  [$($test.Id)] repeticao $run/$Repetitions..." -NoNewline
            $safeModel = ($model -replace '[^a-zA-Z0-9._-]', '_')
            $monitorCsv = Join-Path $runDir ("monitor-{0}-{1}-r{2}.csv" -f $safeModel, $test.Id, $run)
            $monitor = Start-ResourceMonitor -CsvPath $monitorCsv -GpuPaths $gpuPaths
            Start-Sleep -Milliseconds ([math]::Min(500, $MonitorIntervalMs))
            $call = Invoke-OllamaGenerate -Model $model -Prompt $test.Prompt -IsWarmup $false
            $samples = @(Stop-ResourceMonitor -Job $monitor -CsvPath $monitorCsv)

            $ramPeak = if ($samples.Count) { [math]::Round(($samples | Measure-Object OllamaRAM_MB -Maximum).Maximum, 2) } else { 0 }
            $ramAvailMin = if ($samples.Count) { [math]::Round(($samples | Measure-Object RAMDisponivel_MB -Minimum).Minimum, 2) } else { 0 }
            $gpuValues = @($samples | Where-Object { $null -ne $_.GPU_Max_Pct } | Select-Object -ExpandProperty GPU_Max_Pct)
            $gpuPeak = if ($gpuValues.Count) { [math]::Round(($gpuValues | Measure-Object -Maximum).Maximum, 2) } else { $null }
            $cpuDelta = 0
            if ($samples.Count -ge 2) {
                $cpuDelta = [math]::Round(([double]$samples[-1].OllamaCPU_Total_s - [double]$samples[0].OllamaCPU_Total_s), 3)
            }

            if ($call.Success) {
                $r = $call.Response
                $answerFile = Join-Path $responsesDir ("{0}-{1}-r{2}.txt" -f $safeModel, $test.Id, $run)
                [string]$r.response | Set-Content -Path $answerFile -Encoding UTF8
                $compliance = Test-ProtheusCompliance -Sql $r.response -Category $test.Category

                $row = [pscustomobject]@{
                    Timestamp = (Get-Date).ToString("o"); Model = $model; TestId = $test.Id; Category = $test.Category; Repetition = $run
                    Success = $true; ProtheusCompliance = $compliance; DoneReason = $r.done_reason
                    PromptTokens = $r.prompt_eval_count; OutputTokens = $r.eval_count
                    PromptTokensPerSecond = Get-SafeRate $r.prompt_eval_count $r.prompt_eval_duration
                    OutputTokensPerSecond = Get-SafeRate $r.eval_count $r.eval_duration
                    TotalSeconds = Convert-NsToSeconds $r.total_duration
                    WallSeconds = [math]::Round($call.WallSeconds, 4)
                    LoadSeconds = Convert-NsToSeconds $r.load_duration
                    PromptEvalSeconds = Convert-NsToSeconds $r.prompt_eval_duration
                    GenerationSeconds = Convert-NsToSeconds $r.eval_duration
                    OllamaRamPeakMB = $ramPeak; RamAvailableMinMB = $ramAvailMin; OllamaCpuSeconds = $cpuDelta; GpuPeakPercent = $gpuPeak
                    ResponseFile = $answerFile; MonitorFile = $(if ($samples.Count) { $monitorCsv } else { $null }); Error = $null
                }
                $results.Add($row)
                $complianceTag = if ($test.Category -eq "SQL") { $(if ($compliance) { " [Oracle OK]" } else { " [Oracle VIOLADO]" }) } else { "" }
                Write-Host (" OK {0:N2} tok/s, {1:N2}s{2}" -f $row.OutputTokensPerSecond, $row.WallSeconds, $complianceTag) -ForegroundColor $(if ($compliance) { "Green" } else { "Yellow" })
            } else {
                $results.Add([pscustomobject]@{
                    Timestamp=(Get-Date).ToString("o"); Model=$model; TestId=$test.Id; Category=$test.Category; Repetition=$run
                    Success=$false; ProtheusCompliance=$false; DoneReason=$null; PromptTokens=0; OutputTokens=0; PromptTokensPerSecond=0; OutputTokensPerSecond=0
                    TotalSeconds=0; WallSeconds=[math]::Round($call.WallSeconds,4); LoadSeconds=0; PromptEvalSeconds=0; GenerationSeconds=0
                    OllamaRamPeakMB=$ramPeak; RamAvailableMinMB=$ramAvailMin; OllamaCpuSeconds=$cpuDelta; GpuPeakPercent=$gpuPeak
                    ResponseFile=$null; MonitorFile=$(if ($samples.Count) { $monitorCsv } else { $null }); Error=$call.Error
                })
                Write-Host " FALHOU: $($call.Error)" -ForegroundColor Red
            }
        }
    }

    if ($UnloadBetweenModels) {
        try {
            $unload = @{ model=$model; prompt=""; stream=$false; keep_alive=0 } | ConvertTo-Json
            $null = Invoke-RestMethod -Uri "$OllamaBaseUrl/api/generate" -Method Post -ContentType "application/json" -Body $unload -TimeoutSec 60
        } catch { Write-Warning "Nao foi possivel descarregar '$model': $($_.Exception.Message)" }
    }
}

$detailedCsv = Join-Path $runDir "resultados-detalhados.csv"
$results | Export-Csv -Path $detailedCsv -NoTypeInformation -Encoding UTF8
$results | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runDir "resultados-detalhados.json") -Encoding UTF8

$summary = @($results | Where-Object Success | Group-Object Model | ForEach-Object {
    $currentModelName = $_.Name
    $g = @($_.Group)
    $rates = [double[]]@($g.OutputTokensPerSecond)
    $latencies = [double[]]@($g.WallSeconds)
    $sqlRuns = @($g | Where-Object { $_.Category -eq "SQL" })
    $compliancePct = if ($sqlRuns.Count -gt 0) { [math]::Round(((($sqlRuns | Where-Object { $_.ProtheusCompliance }).Count / $sqlRuns.Count) * 100), 1) } else { 100.0 }
    $failedCount = @($results | Where-Object { $_.Model -eq $currentModelName -and -not $_.Success }).Count
    [pscustomobject]@{
        Model = $currentModelName
        SuccessfulRuns = $g.Count
        FailedRuns = $failedCount
        AvgOutputTokensPerSecond = [math]::Round(($rates | Measure-Object -Average).Average, 2)
        P50WallSeconds = Get-Percentile $latencies 50
        P95WallSeconds = Get-Percentile $latencies 95
        AvgWallSeconds = [math]::Round(($latencies | Measure-Object -Average).Average, 2)
        OracleCompliance = "$compliancePct%"
        PeakOllamaRamMB = [math]::Round(($g.OllamaRamPeakMB | Measure-Object -Maximum).Maximum, 2)
        PeakGpuPercent = $(if (@($g | Where-Object { $null -ne $_.GpuPeakPercent }).Count) { [math]::Round(($g.GpuPeakPercent | Measure-Object -Maximum).Maximum, 2) } else { $null })
    }
})
$summaryCsv = Join-Path $runDir "resumo-por-modelo.csv"
$summary | Export-Csv -Path $summaryCsv -NoTypeInformation -Encoding UTF8

Write-Host "`nResumo Comparativo - Copilot Protheus" -ForegroundColor Cyan
$summary | Format-Table Model, SuccessfulRuns, FailedRuns, AvgOutputTokensPerSecond, P50WallSeconds, AvgWallSeconds, OracleCompliance, PeakOllamaRamMB, PeakGpuPercent -AutoSize
Write-Host "Arquivos gerados em: $runDir" -ForegroundColor Green
Write-Host "Detalhes: $detailedCsv"
Write-Host "Resumo:   $summaryCsv"
