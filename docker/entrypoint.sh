#!/usr/bin/env bash
# Container entrypoint. Usage: entrypoint.sh [api|worker|beat]
set -euo pipefail

ROLE="${1:-api}"

wait_for() {
  local name="$1" host="$2" port="$3" retries=30
  echo "Waiting for ${name} at ${host}:${port}..."
  until (echo > "/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [ "${retries}" -le 0 ]; then
      echo "ERROR: ${name} not reachable at ${host}:${port}" >&2
      exit 1
    fi
    sleep 2
  done
  echo "${name} is up."
}

# Best-effort dependency waits (host/port come from compose env; ignore if unset).
[ -n "${POSTGRES_HOST:-}" ] && wait_for "PostgreSQL" "${POSTGRES_HOST}" "${POSTGRES_PORT:-5432}"
[ -n "${REDIS_HOST:-}" ] && wait_for "Redis" "${REDIS_HOST}" "${REDIS_PORT:-6379}"

case "${ROLE}" in
  api)
    echo "Applying database migrations..."
    alembic upgrade head
    echo "Starting API server..."
    exec gunicorn app.main:app \
      -w "${WEB_CONCURRENCY:-4}" \
      -k uvicorn.workers.UvicornWorker \
      -b 0.0.0.0:8000 \
      --access-logfile - --error-logfile -
    ;;
  worker)
    echo "Starting Celery worker..."
    exec celery -A app.workers.celery_app.celery_app worker --loglevel=info --concurrency="${CELERY_CONCURRENCY:-4}"
    ;;
  beat)
    echo "Starting Celery beat..."
    exec celery -A app.workers.celery_app.celery_app beat --loglevel=info
    ;;
  *)
    exec "$@"
    ;;
esac
