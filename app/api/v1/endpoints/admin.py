from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.chat import Chat
from app.models.dataset import Dataset, DatasetStatus
from app.models.forecast import Forecast
from app.models.report import Report
from app.models.user import User
from app.services.ai_service import is_ai_configured

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)) -> dict:
    """Aggregate platform metrics + service health for the admin dashboard."""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    return {
        "totals": {
            "users": _count(db, User),
            "datasets": _count(db, Dataset),
            "forecasts": _count(db, Forecast),
            "reports": _count(db, Report),
            "chats": _count(db, Chat),
        },
        "users": {
            "active": int(db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0),
            "verified": int(db.scalar(select(func.count()).select_from(User).where(User.is_email_verified.is_(True))) or 0),
            "new_this_week": int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= week_ago)) or 0),
        },
        "datasets": {
            "processing": int(
                db.scalar(
                    select(func.count()).select_from(Dataset).where(Dataset.status == DatasetStatus.PROCESSING)
                )
                or 0
            ),
            "errored": int(
                db.scalar(select(func.count()).select_from(Dataset).where(Dataset.status == DatasetStatus.ERROR)) or 0
            ),
        },
        "services": {
            "database": True,  # this query succeeded
            "redis_configured": bool(settings.REDIS_URL),
            "celery_eager": settings.CELERY_TASK_ALWAYS_EAGER,
            "ai_configured": is_ai_configured(),
            "environment": settings.APP_ENV,
        },
    }
