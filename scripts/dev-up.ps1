<#
.SYNOPSIS
  One-click local development environment for CropAI (Windows / Docker Desktop).

.DESCRIPTION
  1. Verifies Docker Desktop is running and env files exist.
  2. Starts PostgreSQL, Redis, Adminer, RedisInsight (docker/compose.dev.yaml)
     and the AgriSmart inference service (docker/compose.ai.yaml).
  3. Waits for health checks, applies Prisma migrations.
  4. Starts `npm run dev` in a new window (unless -NoNext) and opens the local URLs.

.EXAMPLE
  .\scripts\dev-up.ps1
  .\scripts\dev-up.ps1 -NoNext -NoBrowser
#>
param([switch]$NoNext, [switch]$NoBrowser, [switch]$NoTools)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

Step 'Checking Docker Desktop'
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker Desktop is not running. Start it and run this script again.' }

Step 'Checking environment files'
if (-not (Test-Path '.env')) { Fail '.env is missing (DATABASE_URL, REDIS_URL, POSTGRES_PORT, REDIS_PORT, AUTH_SECRET). See docs/platform-upgrade/12-docker-development-environment.md' }
if (-not (Test-Path '.env.local')) { Fail '.env.local is missing (AI_SERVICE_TOKEN, AI_INFERENCE_BASE_URL). See docs/agrismart-implementation/README.md' }
$envText = (Get-Content '.env', '.env.local' -Raw) -join "`n"
foreach ($key in 'DATABASE_URL', 'REDIS_URL', 'AI_SERVICE_TOKEN') {
  if ($envText -notmatch "(?m)^$key=.+") { Fail "$key is not set in .env / .env.local" }
}
if (-not (Test-Path 'ai/models/agrismart-india/checkpoints/model.pt')) {
  Fail 'Model weights missing. Run: python ai/models/agrismart-india/scripts/download_weights.py'
}

Step 'Checking for port conflicts with other projects'
$pgPort = if ($envText -match '(?m)^POSTGRES_PORT=(\d+)') { $Matches[1] } else { '5432' }
$conflict = docker ps --format '{{.Names}} {{.Ports}}' | Where-Object { $_ -match ":$pgPort->" -and $_ -notmatch '^hackathon-postgres ' }
if ($conflict) { Fail "Port $pgPort is used by another container: $conflict. Stop it in Docker Desktop (it belongs to another project) or change POSTGRES_PORT." }

Step 'Starting PostgreSQL, Redis, data tools and the AgriSmart inference service'
# Both compose files share the "docker" project, so they are started together (no orphan warnings).
$compose = @('--env-file', '.env', '--env-file', '.env.local', '-f', 'docker/compose.dev.yaml', '-f', 'docker/compose.ai.yaml', '--profile', 'redis')
$services = @('postgres', 'redis', 'ai-inference')
if (-not $NoTools) { $compose += @('--profile', 'tools'); $services += @('adminer', 'redisinsight') }
docker compose @compose up -d --wait @services
if ($LASTEXITCODE -ne 0) { Fail 'A container did not become healthy. Run .\scripts\dev-logs.ps1 <service>' }

Step 'Applying database migrations'
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Fail 'Prisma migrations failed.' }

if (-not $NoNext) {
  $busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($busy) {
    Write-Host 'Next.js already running on :3000' -ForegroundColor Yellow
  } else {
    Step 'Starting Next.js (new window)'
    Start-Process powershell -WorkingDirectory $Root -ArgumentList '-NoExit', '-Command', 'npm run dev'
    $deadline = (Get-Date).AddSeconds(120)
    do {
      Start-Sleep -Seconds 2
      try { $ok = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://localhost:3000/api/v1/diagnosis/status').StatusCode -eq 200 } catch { $ok = $false }
    } until ($ok -or (Get-Date) -gt $deadline)
    if (-not $ok) { Write-Host 'Next.js is still compiling — check its window.' -ForegroundColor Yellow }
  }
}

& "$PSScriptRoot\dev-status.ps1"

$urls = @('http://localhost:3000', 'http://localhost:3000/dev/model-lab')
if (-not $NoTools) { $urls += @('http://localhost:8080/?pgsql=postgres&username=postgres&db=hackathon_db', 'http://localhost:5540') }
if (-not $NoBrowser) { $urls | ForEach-Object { Start-Process $_ } }
