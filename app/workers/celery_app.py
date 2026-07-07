from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "insightiq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.dataset_tasks",
        # forecast_tasks and report_tasks are registered here once the
        # forecasting and reporting modules are built (see project roadmap).
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=15 * 60,
    task_soft_time_limit=12 * 60,
    worker_max_tasks_per_child=50,
    result_expires=60 * 60 * 24,
)
