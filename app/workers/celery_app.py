from celery import Celery
from celery.signals import worker_process_init

# Import the model aggregator so EVERY ORM class (User, Dataset, …) is registered
# in the SQLAlchemy mapper registry inside worker processes. Without this a task
# that touches Dataset fails to configure its relationship("User") mapper.
import app.db.base  # noqa: F401
from app.core.config import settings


@worker_process_init.connect
def _init_worker_monitoring(**_kwargs) -> None:
    # Initialise Sentry inside each worker process so background-task exceptions
    # are reported. No-op when SENTRY_DSN is unset.
    from app.core.monitoring import init_sentry

    init_sentry()


celery_app = Celery(
    "insightiq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.dataset_tasks",
        "app.workers.tasks.forecast_tasks",
        "app.workers.tasks.report_tasks",
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
    task_acks_late=True,  # re-deliver if a worker dies mid-task
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=settings.CELERY_TASK_ALWAYS_EAGER,
)
