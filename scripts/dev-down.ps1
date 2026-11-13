<#
.SYNOPSIS  Stop CropAI containers (data volumes are kept) and the Next.js dev server.
.PARAMETER KeepNext  Leave the Next.js dev server running.
#>
param([switch]$KeepNext)
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

docker compose --env-file .env --env-file .env.local -f docker/compose.dev.yaml -f docker/compose.ai.yaml --profile redis --profile tools stop postgres redis adminer redisinsight ai-inference

if (-not $KeepNext) {
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" } |
    Where-Object { $_.CommandLine -match 'next' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped Next.js (pid $($_.ProcessId))" }
}
Write-Host 'Stopped. Database and Redis data are preserved in Docker volumes.' -ForegroundColor Green
