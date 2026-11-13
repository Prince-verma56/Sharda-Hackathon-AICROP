<#
.SYNOPSIS  Show CropAI container health and local URLs.
#>
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "`nContainers" -ForegroundColor Green
docker ps -a --filter 'name=hackathon-' --filter 'name=agrismart-inference' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

function Probe($name, $url) {
  try {
    $code = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 $url).StatusCode
    $state = if ($code -lt 400) { 'up' } else { "HTTP $code" }
  } catch { $state = 'down' }
  [pscustomobject]@{ Service = $name; State = $state; Url = $url }
}

Write-Host "`nLocal URLs" -ForegroundColor Green
@(
  Probe 'Next.js app'            'http://localhost:3000'
  Probe 'Model lab (dev)'        'http://localhost:3000/dev/model-lab'
  Probe 'FastAPI health'         'http://127.0.0.1:8001/health'
  Probe 'Adminer (PostgreSQL)'   'http://localhost:8080'
  Probe 'RedisInsight'           'http://localhost:5540'
) | Format-Table -AutoSize

Write-Host 'Adminer login: System=PostgreSQL, Server=postgres, User=postgres, Password=postgres, Database=hackathon_db'
Write-Host 'Prisma Studio (optional): npx prisma studio  ->  http://localhost:5555'
Write-Host 'FastAPI Swagger is disabled in the container (AI_INFERENCE_ENABLE_DOCS=false); run the service on the host for /docs.'
