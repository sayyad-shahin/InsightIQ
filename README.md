# InsightIQ Backend

AI Enterprise Decision Intelligence Platform — FastAPI backend.

Upload datasets (CSV / Excel / PDF / SQL), profile them asynchronously, run
forecasts, generate reports, and chat over your data.

## Stack

- **API:** FastAPI + Uvicorn/Gunicorn
- **DB:** PostgreSQL 16 + SQLAlchemy 2.0 + Alembic
- **Async jobs:** Celery + Redis
- **Auth:** JWT (access/refresh) + Google OAuth 2.0, bcrypt password hashing
- **Analytics:** pandas, scikit-learn (Prophet + Gemini optional)

## Quick start (Docker)

```bash
cp .env.example .env          # then edit SECRET_KEY and any providers
docker compose up --build
```

This starts PostgreSQL, Redis, the API (migrations run automatically on boot),
and a Celery worker. API docs: http://localhost:8000/api/docs

Seed initial users (optional):

```bash
docker compose exec api python -m app.db.seed
```

## Local development

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# optional AI/ML extras (Prophet forecasting, Gemini chat):
# pip install -r requirements-optional.txt

cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
# in another shell:
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

## Tests

```bash
pytest
```

The suite runs on in-memory SQLite by default (no external services needed).
To run against PostgreSQL (recommended in CI):

```bash
export TEST_DATABASE_URL=postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq_test
pytest
```

## API surface

| Area | Endpoints |
|------|-----------|
| Health | `GET /api/health` |
| Auth | `POST /api/v1/auth/{signup,login,refresh,logout,forgot-password,reset-password}`, `GET /api/v1/auth/verify-email/{token}`, `GET /api/v1/auth/google/{login,callback}` |
| Users | `GET/PATCH /api/v1/users/me`, admin: `GET /api/v1/users`, `PATCH /api/v1/users/{id}/role` |
| Settings | `GET/PATCH /api/v1/settings/me` |
| Datasets | `POST /api/v1/datasets/upload`, `GET /api/v1/datasets`, `GET /api/v1/datasets/{id}[/preview|/quality-report]`, `DELETE /api/v1/datasets/{id}` |
| Reports | `POST/GET /api/v1/reports`, `GET/DELETE /api/v1/reports/{id}` |
| Forecasts | `POST/GET /api/v1/forecasts`, `GET/DELETE /api/v1/forecasts/{id}` |
| Chat | `POST/GET /api/v1/chats`, `GET/DELETE /api/v1/chats/{id}`, `POST /api/v1/chats/{id}/messages` |
| Audit | admin: `GET /api/v1/audit-logs` |

## Configuration

All settings come from environment variables / `.env` — see
[.env.example](.env.example). In `APP_ENV=production` the app refuses to start
with a placeholder or weak `SECRET_KEY`.
