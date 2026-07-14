# InsightIQ Celery worker (native, no Docker).
# IMPORTANT: --pool=solo is REQUIRED on Windows. Celery's default prefork pool
# does not work on Windows and tasks will silently fail without it.
$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "==> Starting Celery worker (solo pool) against the broker in .env  (Ctrl+C to stop)" -ForegroundColor Green
python -m celery -A app.workers.celery_app.celery_app worker --pool=solo --loglevel=info
