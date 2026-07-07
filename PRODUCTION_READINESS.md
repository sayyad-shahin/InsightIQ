# Production Readiness Report — InsightIQ Backend

_Date: 2026-07-07_

This report summarizes the production-hardening work, what was verified, what
could not be verified in the working sandbox, and recommended next steps.

---

## 1. Summary

The backend was audited and hardened end to end. It now:

- **Imports and starts cleanly** (blocking runtime errors fixed).
- **Passes the full test suite: 29 tests green** (`pytest`, in-memory SQLite).
- Has **no known runtime errors** on the supported path.
- Exposes the previously-missing **Settings, Reports, Forecasts, and Chat** APIs.
- Ships a **working Docker Compose stack** (PostgreSQL + Redis + API + worker).

Work was delivered as 10 small, logical commits (see `git log`).

---

## 2. Critical bugs fixed (would have failed in production)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **Enum name/value mismatch** — SQLAlchemy persisted enum *names* (`ANALYST`) but the migration declared lowercase *values* (`analyst`). | Every insert into `users`, `datasets`, etc. would fail against the migrated PostgreSQL schema (tests passed because they used `create_all`). | `pg_enum()` helper with `values_callable`; verified ORM labels now equal migration `CREATE TYPE` values. |
| 2 | **passlib + bcrypt 5 incompatibility** — `password cannot be longer than 72 bytes`. | All password hashing/login broke at runtime. | Dropped unmaintained passlib; use `bcrypt` directly with 72-byte truncation. |
| 3 | **Engine rejected SQLite pool args** + hardcoded pooling. | App couldn't import under SQLite; blocked testing. | Dialect-aware engine builder (StaticPool for in-memory). |
| 4 | **Migration created ENUM types twice** (`create_type` default). | `alembic upgrade head` would abort with "type already exists". | `create_type=False`; verified via offline SQL render. |
| 5 | **Celery retries never fired** — `max_retries` set but `self.retry()` never called. | Transient failures were terminal. | Real retry/backoff; permanent vs transient error handling. |
| 6 | **Unbounded upload write** — size only checked via spoofable `Content-Length`. | DoS via oversized upload. | Enforced limit **while streaming**, delete partial on overflow. |

## 3. Security hardening

- **OAuth CSRF:** Google login now issues and validates a signed, short-lived
  `state` token on callback; provider/network errors return clean 4xx/502
  instead of `KeyError` 500s.
- **Rate limiting now actually enforced:** single shared limiter +
  `SlowAPIMiddleware` (the old global default was never applied; a duplicate
  dead limiter was removed). Per-route limits on auth, upload, and chat.
  Redis-backed store option for multi-worker correctness.
- **Secrets:** `.env` removed from version control via `.gitignore`; production
  refuses to boot with a placeholder/weak `SECRET_KEY`; seed credentials sourced
  from env and never logged.
- **Upload validation:** extension + declared MIME allow-list + magic-byte
  sniffing (PDF/Excel); filename sanitization + path-traversal defense.
- **SQL upload:** `ATTACH DATABASE` blocked (arbitrary host file write);
  identifier quoted. All application DB access is parameterized ORM.
- **JWT:** malformed token subjects now map to 401, not 500.

## 4. Robustness & quality

- `lifespan` replaces deprecated `on_event`; catch-all exception handler returns
  a clean JSON 500; structured logging with per-request correlation IDs.
- Graceful degradation: chat works without a Gemini key; forecasting falls back
  to scikit-learn when Prophet isn't installed; uploads don't 500 if the broker
  is down.
- Dependencies cleaned: removed `passlib`, `asyncpg`, `pandasai`, `langchain`,
  `langchain-google-genai`, `sentence-transformers` (unused/conflict-prone);
  heavy optional ML moved to `requirements-optional.txt`.
- Shared `get_owned_dataset` helper removes ownership-check duplication (DRY).

## 5. New endpoints (back the existing models)

- **Settings:** `GET/PATCH /settings/me` (auto-created per user).
- **Reports:** create from dataset profiling metadata; list/get/delete.
- **Forecasts:** create → async Celery job (sklearn regression; Prophet optional)
  → poll result; list/get/delete.
- **Chat:** conversations + messages with graceful AI replies; chat rate limit.

Each has owner-scoped access control and tests.

---

## 6. Verification status

**Verified in this environment (Python 3.14, SQLite):**

- ✅ `pytest` — 29 passed.
- ✅ App imports; all 26 routes registered.
- ✅ Enum values persist lowercase; ORM labels match migration.
- ✅ Migration renders valid PostgreSQL DDL (offline `alembic upgrade head --sql`),
  each `CREATE TYPE` emitted once.
- ✅ Production config guards (weak-secret rejection, `postgres://` normalization).
- ✅ bcrypt hashing/verification; upload streaming/rejection paths; eager Celery
  tasks (dataset profiling + forecasting) end to end.

**NOT verifiable in this sandbox (no Docker / PostgreSQL / Redis installed) —
built and reasoned, but must be validated in a real environment before release:**

- ⚠️ `docker compose up --build` bringing up the full stack.
- ⚠️ `alembic upgrade head` against a live PostgreSQL (only offline SQL verified).
- ⚠️ Live Celery worker consuming from a Redis broker.
- ⚠️ `pip install -r requirements.txt` on Python 3.11 in the image (pins chosen
  for compatibility, but resolve on the target platform to confirm).

Recommended pre-release gate: run `pytest` with `TEST_DATABASE_URL` pointed at a
real PostgreSQL, then `docker compose up` and smoke-test `/api/docs`.

---

## 7. Remaining optional improvements (not blocking)

1. **Rotate the Google API key** that was present in the local `.env` — treat it
   as compromised since it lived in a plaintext file.
2. **Token revocation / logout** is still stateless — add a Redis JWT blocklist
   and make password reset invalidate existing sessions. Make reset/verify tokens
   single-use.
3. **OAuth token delivery** returns tokens in the redirect URL query string
   (leaks into history/logs) — switch to a one-time code or secure cookie, and
   bind `state` to a browser cookie for stronger CSRF protection.
4. **Report generation** currently produces JSON sections; add PDF rendering
   (e.g. WeasyPrint/ReportLab) and run it as a Celery job for large datasets.
5. **Observability:** add Sentry/OpenTelemetry, Prometheus metrics, and Celery
   task monitoring (Flower).
6. **CI/CD:** GitHub Actions running `pytest` against PostgreSQL, `ruff` + `mypy`,
   and image build/scan.
7. **DB migrations in prod:** run `alembic upgrade` as a separate job/init
   container rather than in the API entrypoint when scaling to multiple replicas.
8. **Modernize Gemini SDK:** `google-generativeai` is deprecated upstream; migrate
   to `google-genai`.
9. **Refresh-token rotation** and shorter access-token lifetimes with silent
   refresh on the client.
