<#
  Shows this computer's candidate LAN addresses for testing the CropAI app on a phone, and
  writes mobile/config/dev.local.json (git-ignored) with the chosen address.

    npm run mobile:lan-ip                 # list addresses, pick the Wi-Fi one automatically
    powershell -File mobile/tool/lan-ip.ps1 -Address 192.168.1.10

  The phone and this computer must be on the SAME Wi-Fi. Never use localhost on a phone.
#>
param([string]$Address, [int]$Port = 3000)

$candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  ForEach-Object {
    $alias = $_.InterfaceAlias
    $virtual = $alias -match 'vEthernet|WSL|Hyper-V|VirtualBox|VMware|Docker|Loopback|Tailscale|ZeroTier'
    [pscustomobject]@{ Interface = $alias; Address = $_.IPAddress; Virtual = $virtual; WiFi = ($alias -match 'Wi-?Fi|WLAN|Wireless') }
  }

Write-Host "`nCandidate addresses (phone and PC must share the network):" -ForegroundColor Green
$candidates | Sort-Object Virtual, @{e={-not $_.WiFi}} | Format-Table -AutoSize | Out-String | Write-Host

if (-not $Address) {
  $pick = $candidates | Where-Object { -not $_.Virtual } | Sort-Object @{e={-not $_.WiFi}} | Select-Object -First 1
  if (-not $pick) { Write-Host 'No physical network adapter found. Connect to Wi-Fi first.' -ForegroundColor Yellow; exit 1 }
  $Address = $pick.Address
}

$url = "http://${Address}:$Port"
$config = [ordered]@{ APP_ENV = 'development'; APP_NAME = 'CropAI Dev'; API_BASE_URL = $url; ALLOW_LOOPBACK = 'false' }
$target = Join-Path $PSScriptRoot '..\config\dev.local.json'
# UTF-8 WITHOUT a byte-order mark (Dart's --dart-define-from-file rejects a BOM).
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($target), ($config | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote $target with API_BASE_URL=$url" -ForegroundColor Green

try {
  $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$url/api/v1/health"
  Write-Host "Backend reachable from this PC at $url (HTTP $($r.StatusCode))." -ForegroundColor Green
} catch {
  Write-Host "Backend NOT reachable at $url. Is 'npm run dev' running (it listens on all interfaces)?" -ForegroundColor Yellow
}

$rule = Get-NetFirewallRule -DisplayName 'CropAI dev (Next.js 3000, private networks)' -ErrorAction SilentlyContinue
if (-not $rule) {
  Write-Host "`nIf the phone cannot connect, allow the port on PRIVATE networks only (run PowerShell as Administrator):" -ForegroundColor Cyan
  Write-Host "  New-NetFirewallRule -DisplayName 'CropAI dev (Next.js 3000, private networks)' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private"
  Write-Host "  (Make sure your Wi-Fi network profile is 'Private', not 'Public'.)"
}
Write-Host "`nBuild/run:  cd mobile; flutter run --flavor dev --dart-define-from-file=config/dev.local.json`n"
