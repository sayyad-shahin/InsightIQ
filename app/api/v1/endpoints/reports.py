import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.db.session import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportDetail, ReportRead
from app.services.dataset_service import get_owned_dataset
from app.services.pdf_service import generate_report_pdf
from app.workers.tasks.report_tasks import generate_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportDetail, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_COMPUTE)
def create_report(
    request: Request,
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Report:
    dataset = get_owned_dataset(db, payload.dataset_id, current_user.id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    # Create the row immediately (sections null = pending) and build the report —
    # which computes AI insights from the full dataset — off the request thread.
    report = Report(dataset_id=dataset.id, owner_id=current_user.id, title=payload.title, sections=None)
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        generate_report.delay(str(report.id))
    except Exception as exc:  # noqa: BLE001 - broker down shouldn't fail creation
        logger.error(f"Failed to enqueue report {report.id}: {exc}")

    db.refresh(report)  # in eager mode the task has already populated sections
    return report


@router.get("", response_model=list[ReportRead])
def list_reports(
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Report]:
    return list(
        db.scalars(
            select(Report)
            .where(Report.owner_id == current_user.id)
            .order_by(Report.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )


def _get_owned_report(db: Session, report_id: uuid.UUID, user: User) -> Report:
    report = db.get(Report, report_id)
    if report is None or report.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.get("/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Report:
    return _get_owned_report(db, report_id, current_user)


@router.get("/{report_id}/download")
def download_report_pdf(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    report = _get_owned_report(db, report_id, current_user)
    pdf_bytes = generate_report_pdf(report)
    filename = f"{report.title.replace(' ', '_')[:60] or 'report'}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    report = _get_owned_report(db, report_id, current_user)
    db.delete(report)
    db.commit()
