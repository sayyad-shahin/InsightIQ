# Running InsightIQ natively on Windows (no Docker, no WSL)

Real PostgreSQL + Redis + a Celery worker — the full production behavior — without
Docker or WSL. You install two things; the rest is scripts that are already wired
to your `.env`.

## 1. Install PostgreSQL 16 (one-time)
1. Download the Windows installer: https://www.postgresql.org/download/windows/
   (the "Download the installer" link → EDB).
2. Run it. When prompted:
   - **Password for the `postgres` superuser:** pick one and remember it.
   - **Port:** `5432` (default).
   - Accept defaults for everything else.
3. Create the app's database + role. Open PowerShell and run (enter the postgres
   password when asked):
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\init-db.sql
   ```
   This creates role `insightiq` / password `insightiq` / database `insightiq`,
   matching `DATABASE_URL` in `.env`.

## 2. Install Memurai (native Redis for Windows, one-time)
Redis has no official Windows build; **Memurai** is a drop-in, Redis-compatible
server that runs as a native Windows service — no WSL needed.
1. Download the free **Developer** edition: https://www.memurai.com/get-memurai
2. Run the installer, accept defaults. It installs as an auto-starting Windows
   service on **port 6379** (same as Redis).
3. Verify (optional): `memurai-cli ping` → should print `PONG`.

## 3. Run it (three terminals)
From the `backend` folder, in three separate PowerShell windows:

```powershell
# Terminal 1 — API (runs migrations, then serves on :8000)
powershell -ExecutionPolicy Bypass -File scripts\run-api.ps1

# Terminal 2 — Celery worker (background jobs; solo pool required on Windows)
powershell -ExecutionPolicy Bypass -File scripts\run-worker.ps1

# Terminal 3 — Frontend (http://localhost:5173)
powershell -ExecutionPolicy Bypass -File scripts\run-frontend.ps1
```

Then open **http://localhost:5173**.

## Health check
- http://localhost:8000/api/health  → `{"status":"ok"}`
- http://localhost:8000/health/ready → should be **200** with
  `{"database":true,"redis":true}` once Postgres + Memurai are running.

## Notes
- The API applies migrations (`alembic upgrade head`) on every start — safe and idempotent.
- Stop any old backend still running on :8000 first (it may be stale code).
- To auto-start api/worker on boot later, they can be registered as Windows
  services with NSSM — ask and I'll set that up.
