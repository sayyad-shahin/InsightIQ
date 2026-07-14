# InsightIQ frontend dev server (native, no Docker). Serves on :5173, proxies /api -> :8000.
$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..\frontend")
if (-not (Test-Path "node_modules")) {
  Write-Host "==> Installing frontend dependencies (first run)..." -ForegroundColor Cyan
  npm install
}
Write-Host "==> Starting frontend on http://localhost:5173  (Ctrl+C to stop)" -ForegroundColor Green
npm run dev
