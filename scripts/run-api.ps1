# InsightIQ API server (native, no Docker).
# Applies DB migrations against the Postgres in .env, then serves on :8000.
$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "==> Applying database migrations (alembic upgrade head)..." -ForegroundColor Cyan
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { Write-Host "Migration failed. Is PostgreSQL running and the 'insightiq' DB created? See scripts\init-db.sql" -ForegroundColor Red; exit 1 }

Write-Host "==> Starting API on http://localhost:8000  (Ctrl+C to stop)" -ForegroundColor Green
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
