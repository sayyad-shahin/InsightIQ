# Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| App refuses to start: `SECRET_KEY must be set…` | `APP_ENV=production` with placeholder/short secret | Set a strong `SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(64))"`). |
| `'NoneType' object has no attribute 'Redis'` | Celery result backend points at Redis but `redis` isn't reachable/installed | Start Redis, or for local/dev set `CELERY_TASK_ALWAYS_EAGER=1`, `CELERY_BROKER_URL=memory://`, `CELERY_RESULT_BACKEND=cache+memory://`. |
| Upload succeeds but dataset stays `uploaded` | No Celery worker consuming jobs | Run `celery -A app.workers.celery_app.celery_app worker`, or use eager mode in dev. |
| `type "user_role" already exists` during migration | Enum created twice | Already fixed (`create_type=False`); ensure you're on the latest migration. |
| Inserts fail with enum value errors on PostgreSQL | Enum name/value mismatch | Models use `values_callable` so stored values are lowercase — matches the migration. Rebuild the DB if it predates this. |
| CORS errors in the browser | Origin not allowed | Add your frontend origin to `CORS_ORIGINS` (JSON array or comma-separated). |
| Chat replies say "AI assistant is not configured" | No `GOOGLE_API_KEY` | Expected — the app still returns **real computed analysis + charts**. Set the key for LLM-phrased narration. |
| Forecast/Prophet unavailable | Optional dep not installed | `pip install -r requirements-optional.txt`; otherwise forecasting falls back to scikit-learn automatically. |
| `413` on upload | File exceeds `MAX_UPLOAD_SIZE_MB` (100 by default) | Raise the limit or split the file. Size is enforced while streaming. |
| Frontend `/api` calls 404 in dev | Backend not running / wrong port | Start the API on `:8000`; Vite proxies `/api` there (see `vite.config.ts`). |
| `pytest` can't connect to Postgres | Default is SQLite; you set `TEST_DATABASE_URL` | Unset it to use in-memory SQLite, or point it at a running Postgres test DB. |
| Large `plotly` chunk warning | Charts bundle | Plotly is a **custom core build** (bar/scatter/pie/heatmap) and lazy-loaded per route; it never blocks initial load. |
