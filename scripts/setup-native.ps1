# InsightIQ — one-time native setup (no Docker / no WSL).
# Ensures Python deps, storage dirs, and .env are in place, then checks that
# PostgreSQL (5432) and Memurai/Redis (6379) are reachable.
$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..")

function Test-Port($server, $port) {
  try { (New-Object System.Net.Sockets.TcpClient).ConnectAsync($server, $port).Wait(1500); $true } catch { $false }
}

Write-Host "==> InsightIQ native setup" -ForegroundColor Cyan

# 1. Python deps
Write-Host "`n[1/4] Installing Python dependencies (requirements.txt)..." -ForegroundColor Cyan
python -m pip install --disable-pip-version-check -q -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed" -ForegroundColor Red; exit 1 }
Write-Host "      OK"

# 2. .env
Write-Host "`n[2/4] Checking .env..." -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "      Created .env from .env.example — review SECRET_KEY before production." -ForegroundColor Yellow
} else { Write-Host "      .env present" }

# 3. Storage dirs
Write-Host "`n[3/4] Creating storage/log directories..." -ForegroundColor Cyan
foreach ($d in @("storage/uploads", "storage/reports", "logs")) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
Write-Host "      OK"

# 4. Service reachability
Write-Host "`n[4/4] Checking backing services..." -ForegroundColor Cyan
$pg = Test-Port "localhost" 5432
$rd = Test-Port "localhost" 6379
Write-Host ("      PostgreSQL (localhost:5432): " + ($(if ($pg) {"REACHABLE"} else {"NOT reachable"}))) -ForegroundColor $(if ($pg) {"Green"} else {"Yellow"})
Write-Host ("      Redis/Memurai (localhost:6379): " + ($(if ($rd) {"REACHABLE"} else {"NOT reachable"}))) -ForegroundColor $(if ($rd) {"Green"} else {"Yellow"})

if (-not $pg) {
  Write-Host "`n      -> Install PostgreSQL 16 (postgresql.org), then create the DB:" -ForegroundColor Yellow
  Write-Host '         & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\init-db.sql' -ForegroundColor Yellow
}
if (-not $rd) {
  Write-Host "`n      -> Install Memurai (memurai.com) — native Redis for Windows, auto-starts on 6379." -ForegroundColor Yellow
}

if ($pg -and $rd) {
  Write-Host "`nSetup complete. Start the app in three terminals:" -ForegroundColor Green
  Write-Host "  scripts\run-api.ps1   |   scripts\run-worker.ps1   |   scripts\run-frontend.ps1"
} else {
  Write-Host "`nInstall the missing service(s) above, then re-run this script." -ForegroundColor Yellow
}
