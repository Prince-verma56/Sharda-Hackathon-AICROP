<#
.SYNOPSIS  Follow logs of a CropAI service.
.EXAMPLE   .\scripts\dev-logs.ps1 ai-inference
.EXAMPLE   .\scripts\dev-logs.ps1 postgres
#>
param([ValidateSet('postgres', 'redis', 'adminer', 'redisinsight', 'ai-inference')][string]$Service = 'ai-inference')
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
docker compose --env-file .env --env-file .env.local -f docker/compose.dev.yaml -f docker/compose.ai.yaml --profile redis --profile tools logs -f --tail 200 $Service
