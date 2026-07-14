# InsightIQ — AI Business Intelligence Copilot

Upload any dataset and instantly get **data-quality profiling, smart cleaning,
interactive analytics, forecasting, anomaly detection, an AI analyst you can chat
with, and exportable executive reports** — a full-stack, production-hardened SaaS.

- **Backend:** FastAPI · SQLAlchemy 2.0 · Alembic · Celery/Redis · PostgreSQL
- **Frontend:** React 19 · TypeScript · Vite · Tailwind · Framer Motion · Plotly · React Query
- **Analytics/AI:** pandas · scikit-learn · (optional Prophet, Google Gemini)

---

## Table of contents

1. [Features](#features) · 2. [Architecture](#architecture) · 3. [Folder structure](#folder-structure)
4. [Quick start (Docker)](#quick-start-docker) · 5. [Local development](#local-development)
6. [Environment configuration](#environment-configuration) · 7. [API reference](#api-reference)
8. [Testing](#testing) · 9. [Deployment](#deployment) · 10. [Troubleshooting](#troubleshooting)

---

## Features

| Module | What it does |
|--------|--------------|
| **Auth** | JWT access/refresh, bcrypt, Google OAuth (state/CSRF), email verify, password reset & change |
| **Datasets** | Drag-drop upload (CSV/Excel/PDF/SQL), async profiling, preview, statistics, correlation, **smart cleaning** (dedup/impute/trim/type-coerce with undo), rename/duplicate/download |
| **AI Chat** | Ask questions in plain English → **grounded pandas analysis** + auto charts, SSE streaming, markdown/code, suggested prompts, history, export |
| **Analytics** | Executive KPIs, trends, category/geographic breakdowns, segmentation, correlation, missing-value analysis, **anomaly dashboard**, business insights, drill-down, chart export (PNG/SVG/PDF) |
| **Forecasting** | Linear/Prophet models, horizon 30/90/180/365, **confidence intervals**, R²/MAE/RMSE, history, CSV export |
| **Reports** | AI executive summaries from real data, **PDF** (reportlab) / Markdown / print, search, pagination |
| **Settings/Profile** | Theme, language, notifications, password, API keys, avatar, per-user stats & activity |
| **Admin** | Platform stats, system health, user/role management, audit log |

---

## Architecture

```
┌────────────────────────── Browser (React 19 SPA) ──────────────────────────┐
│  Vite · Tailwind · Framer Motion · React Query · Plotly (lazy)              │
│  features/{auth,dashboard,datasets,chat,analytics,forecasts,reports,        │
│            settings,profile,admin}  ·  components/ui (shadcn-style)         │
└───────────────┬────────────────────────────────────────────────────────────┘
                │  /api/v1  (JWT bearer; Vite proxy in dev)
                ▼
┌────────────────────────── FastAPI (app/) ──────────────────────────────────┐
│  api/v1/endpoints  →  services/ (business logic)  →  models/ (SQLAlchemy)   │
│  core/ (config, security, logging, rate-limit)                             │
│         │ enqueue slow work                                                 │
│         ▼                                                                    │
│  workers/ (Celery)  ──uses──►  Redis (broker/results)                       │
└───────────────┬─────────────────────────────────────────────────────────────┘
                ▼
          PostgreSQL 16  (portable models also run on SQLite for tests)
```

**Request flow (upload):** API validates + streams the file to disk, creates a
`Dataset` row, returns `201`, and enqueues a Celery job. The worker profiles the
file with pandas and flips the status to `cleaned`; the SPA polls until ready.

---

## Folder structure

```
backend/
├── app/
│   ├── api/v1/endpoints/   auth, users, settings, admin, datasets, reports,
│   │                       forecasts, chats, audit_logs
│   ├── services/           user, dataset, analysis, analytics, forecast, chat,
│   │                       ai, report, pdf, storage, email, audit
│   ├── models/             user, dataset, chat, forecast, report, setting, audit_log
│   ├── schemas/            pydantic request/response
│   ├── workers/            celery_app + tasks (dataset, forecast)
│   ├── core/               config, security, logging, limiter
│   └── db/                 base, session, seed
├── alembic/                migrations
├── tests/                  pytest (58 tests)
├── docker/entrypoint.sh    api|worker|beat roles
├── Dockerfile · docker-compose.yml · requirements.txt
└── frontend/
    ├── src/
    │   ├── features/       one folder per screen (page + components + hooks)
    │   ├── components/     ui/ (primitives) · charts/ · shared/ · brand/ · shell/
    │   ├── lib/            api client, plotly bundle, query, utils
    │   ├── providers/      theme, auth · routes/ · layouts/ · types/
    │   └── test/           vitest setup + helpers
    └── vite.config.ts · tailwind.config.js · package.json
```

---

## Quick start (Docker)

Requires Docker Desktop.

```bash
cp .env.example .env          # set a strong SECRET_KEY (see below)
docker compose up --build     # postgres + redis + api (migrates on boot) + worker
docker compose exec api python -m app.db.seed   # optional demo users
```

- API + docs: http://localhost:8000/api/docs
- Frontend (run separately in dev): see below. In production, build the SPA and
  serve `frontend/dist` behind your web server / CDN, proxying `/api` to the API.

---

## Local development

**Backend**
```bash
python -m venv .venv && source .venv/bin/activate   # (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
# optional AI/ML extras (Prophet forecasting, Gemini chat):
pip install -r requirements-optional.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
# separate shell — background worker:
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

Zero-infra option (SQLite + inline jobs, no Postgres/Redis): set
`DATABASE_URL=sqlite+pysqlite:///./insightiq_dev.db`, `CELERY_TASK_ALWAYS_EAGER=1`,
`CELERY_BROKER_URL=memory://`, `CELERY_RESULT_BACKEND=cache+memory://`, then
`python -c "from app.db.base import Base; from app.db.session import engine; Base.metadata.create_all(engine)"`.

**Frontend**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (Vite proxies /api → :8000)
```

Generate a strong secret: `python -c "import secrets; print(secrets.token_urlsafe(64))"`

---

## Environment configuration

All settings come from env / `.env` — see [.env.example](.env.example). Key ones:

| Var | Purpose |
|-----|---------|
| `SECRET_KEY` | JWT signing (prod refuses placeholder/weak values) |
| `DATABASE_URL` | `postgresql+psycopg2://…` (also accepts `postgres://`) |
| `REDIS_URL` / `CELERY_*` | broker/result backend |
| `RATE_LIMIT_*` | per-route limits; `RATE_LIMIT_STORAGE_URI` → Redis for multi-worker |
| `GOOGLE_API_KEY` / `GEMINI_MODEL` | optional AI chat (degrades gracefully) |
| `GOOGLE_OAUTH_*`, `SMTP_*` | optional Google login + email |
| `CORS_ORIGINS` | JSON array or comma-separated |

---

## API reference

Interactive OpenAPI at **`/api/docs`** (Swagger) and `/api/redoc`. Highlights:

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/{signup,login,refresh,logout,forgot-password,reset-password}`, `GET /auth/verify-email/{token}`, `GET /auth/google/{login,callback}` |
| Users | `GET/PATCH /users/me`, `POST /users/me/password`; admin: `GET /users`, `PATCH /users/{id}/role` |
| Settings | `GET/PATCH /settings/me` |
| Datasets | `POST /datasets/upload`, `GET /datasets`, `GET /datasets/{id}[/preview\|/statistics\|/analytics\|/quality-report\|/download]`, `PATCH` rename, `POST /{id}/duplicate`, `POST /{id}/clean/{preview,apply,undo}`, `DELETE` |
| Forecasts | `POST/GET /forecasts`, `GET/DELETE /forecasts/{id}` (result carries CI + metrics) |
| Chat | `POST/GET /chats`, `GET/DELETE /chats/{id}`, `PATCH` rename, `POST /{id}/messages`, `POST /{id}/messages/stream` (SSE) |
| Reports | `POST/GET /reports`, `GET /reports/{id}`, `GET /reports/{id}/download` (PDF), `DELETE` |
| Admin | `GET /admin/stats`, `GET /audit-logs` |
| Health | `GET /api/health` |

---

## Testing

```bash
# Backend (58 tests) — runs on in-memory SQLite, no external services
pytest
# against real PostgreSQL:
TEST_DATABASE_URL=postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq_test pytest

# Frontend (17 tests) + type-check + build
cd frontend
npm test
npm run build      # tsc --noEmit && vite build
```

Frontend tests use Vitest + Testing Library (jsdom); Plotly is mocked. See
[frontend/src/test](frontend/src/test).

---

## Deployment

1. Set production env: `APP_ENV=production`, strong `SECRET_KEY`, managed
   PostgreSQL + Redis URLs, `RATE_LIMIT_STORAGE_URI=<redis>`, `CORS_ORIGINS`.
2. Build & run containers: `docker compose up --build -d` (API entrypoint runs
   `alembic upgrade head` then gunicorn+uvicorn workers; a separate `worker`
   service runs Celery). Scale API/worker independently.
3. Build the SPA: `cd frontend && npm run build`; serve `dist/` via CDN/static
   host, proxying `/api` to the API service. Plotly is lazy-loaded, so initial
   load stays light.
4. Health check: `GET /api/health`. Logs are structured JSON in production with a
   per-request `X-Request-ID`.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the hardening report
and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Troubleshooting

Common issues and fixes are in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
(broker errors, migration/enum notes, CORS, AI-not-configured, upload limits).
"# InsightIQ" 
