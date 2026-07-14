# InsightIQ — Complete Project Guide (Links, Run Steps, Data)

One-stop reference for running, testing, inspecting, and presenting InsightIQ.

- **Project:** InsightIQ — AI Business Intelligence Copilot (FastAPI + React 19)
- **Author:** Shahin Sayyad
- **Repo (SSH):** `git@github.com:sayyad-shahin/InsightIQ.git`
- **Repo (web):** https://github.com/sayyad-shahin/InsightIQ

---

## 1. GitHub links (to show progress)

| What | Link |
|------|------|
| Repository | https://github.com/sayyad-shahin/InsightIQ |
| Commit history (43 commits) | https://github.com/sayyad-shahin/InsightIQ/commits/main |
| Contributors / activity graph | https://github.com/sayyad-shahin/InsightIQ/graphs/contributors |
| Commit activity | https://github.com/sayyad-shahin/InsightIQ/graphs/commit-activity |
| Code frequency | https://github.com/sayyad-shahin/InsightIQ/graphs/code-frequency |

**43 real commits, 2026-07-07 → 2026-07-14** (see §8 for the work log).

---

## 2. Live application URLs (when running locally)

| Service | URL |
|---------|-----|
| **Frontend (app)** | http://localhost:5173 |
| **Backend API health** | http://localhost:8000/api/health |
| Liveness | http://localhost:8000/health/live |
| Readiness (DB+Redis) | http://localhost:8000/health/ready → `{"database":true,"redis":true}` |
| **Swagger UI (interactive API)** | http://localhost:8000/api/docs |
| ReDoc (API reference) | http://localhost:8000/api/redoc |
| OpenAPI spec (JSON) | http://localhost:8000/api/openapi.json |

---

## 3. Backing services (native Windows — no Docker/WSL)

| Service | Host:Port | DB / creds |
|---------|-----------|------------|
| PostgreSQL 16 | `localhost:5432` | database `insightiq`, user `insightiq`, password `insightiq` |
| Redis (Memurai) | `localhost:6379` | — |

> Production: install **PostgreSQL 16** (postgresql.org) + **Memurai** (memurai.com) as Windows services. During this session a portable PostgreSQL was used at `C:\iqpg` for verification.

---

## 4. How to run everything (3 terminals from the `backend` folder)

```powershell
# One-time setup (deps, .env, storage dirs, service check)
powershell -ExecutionPolicy Bypass -File scripts\setup-native.ps1

# Terminal 1 — API (runs Alembic migrations, then serves :8000)
powershell -ExecutionPolicy Bypass -File scripts\run-api.ps1

# Terminal 2 — Celery worker (background jobs; --pool=solo required on Windows)
powershell -ExecutionPolicy Bypass -File scripts\run-worker.ps1

# Terminal 3 — Frontend (:5173, proxies /api → :8000)
powershell -ExecutionPolicy Bypass -File scripts\run-frontend.ps1
```

Then open **http://localhost:5173**. Full guide: [NATIVE-SETUP.md](NATIVE-SETUP.md).

### First-time database creation (once, after installing PostgreSQL)
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\init-db.sql
```

---

## 5. Test data files (on Desktop)

| File | Use |
|------|-----|
| `C:\Users\ACS\Desktop\sample-sales.csv` | quick upload test (month, region, revenue, units, customers) |
| `C:\Users\ACS\Desktop\insightiq-report-test.csv` | full **report** test — 144 rows: date + region + product + 4 measures, with a deliberate outlier + missing value |

### Test flow
1. Open http://localhost:5173 → **Sign up** → log in.
2. **Datasets → Upload** the CSV → wait for status **cleaned** (Celery processes it).
3. **Analytics** → charts (trend, breakdowns, correlation, anomalies).
4. **Reports → Generate report** → executive summary (overview, data quality, insights, highlights).
5. Export: PNG / SVG / Markdown / Print-to-PDF.

---

## 6. Inspect the backend / data

```powershell
# Tables
& "C:\iqpg\pgsql\bin\psql.exe" -U insightiq -h localhost -p 5432 -d insightiq -c "\dt"
# Datasets
& "C:\iqpg\pgsql\bin\psql.exe" -U insightiq -h localhost -p 5432 -d insightiq -c "SELECT name,status,row_count,column_count,created_at FROM datasets ORDER BY created_at DESC;"
# Users / audit log
& "C:\iqpg\pgsql\bin\psql.exe" -U insightiq -h localhost -p 5432 -d insightiq -c "SELECT email,role,created_at FROM users;"
& "C:\iqpg\pgsql\bin\psql.exe" -U insightiq -h localhost -p 5432 -d insightiq -c "SELECT action,ip_address,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20;"
```
GUI alternative: **DBeaver** / **pgAdmin** → host `localhost`, port `5432`, db/user/pw `insightiq`.

---

## 7. Tech stack

- **Backend:** FastAPI · SQLAlchemy 2.0 · Alembic · Celery + Redis · PostgreSQL 16 · Pydantic v2
- **Frontend:** React 19 · TypeScript · Vite 6 · TailwindCSS · Framer Motion · Plotly · React Query · React Router
- **Analytics/AI:** pandas · scikit-learn · (optional Prophet, Google Gemini)
- **Auth:** JWT in httpOnly cookies + double-submit CSRF · bcrypt · Google OAuth
- **Quality:** pytest (75) · Vitest (28) · ESLint · Prettier · GitHub Actions CI · Sentry (optional)

---

## 8. Work log (the 43 real commits)

| Date | Theme |
|------|-------|
| **Jul 7** | Backend foundation — bcrypt auth, upload limits, OAuth state, rate limits, Celery retries, Docker build, migrations, SQLite test suite, deps cleanup |
| **Jul 9** | Feature build-out — Datasets, AI Chat (SSE), Analytics, Forecasting, Reports (PDF), Admin; httpOnly-cookie auth + CSRF; caching/pagination/perf; full README |
| **Jul 10** | Hardening — Sentry, security headers, LRU+TTL cache, GitHub Actions CI, ESLint/Prettier, self-XSS fix |
| **Jul 11** | CI fixes, rate-limit/cookie tests, Docker worker healthcheck, cleanups |
| **Jul 14** | Native Windows run scripts, Celery ORM-mapper bug fix, all three Plotly browser errors resolved, GitHub publish |

---

## 9. Verification results (evidence)

- **Backend tests:** 75 passed (pytest, Python 3.11)
- **Frontend tests:** 28 passed (Vitest); TypeScript clean; ESLint 0 errors; Prettier clean
- **Production build:** succeeds (`vite build`)
- **Live API E2E:** signup / login / JWT / CSRF / security headers / rate-limit 429 / CSV upload → Celery → PostgreSQL update — all verified over real HTTP
- **Browser (headless Chrome, dev + prod):** all routes load, charts render, **0 uncaught errors, 0 console errors**
- **Health:** `/health/ready` → `{"database":true,"redis":true}`

---

## 10. Key files & folders

```
backend/
├── app/                     FastAPI backend (api, services, models, workers, core)
├── alembic/                 database migrations
├── tests/                   pytest suite (75 tests)
├── scripts/                 native run scripts (setup/api/worker/frontend/init-db)
├── frontend/                React 19 + Vite app
├── NATIVE-SETUP.md          native Windows setup guide
├── PROJECT_GUIDE.md         this file
├── README.md                full project documentation
├── Dockerfile · docker-compose.yml   optional (not used natively)
└── .env.example             config template (real .env is gitignored)
```
