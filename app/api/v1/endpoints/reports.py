import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportDetail, ReportRead
from app.services.dataset_service import get_owned_dataset
from app.services.report_service import build_report_sections

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportDetail, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Report:
    dataset = get_owned_dataset(db, payload.dataset_id, current_user.id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    report = Report(
        dataset_id=dataset.id,
        owner_id=current_user.id,
        title=payload.title,
        sections=build_report_sections(dataset),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=list[ReportRead])
def list_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Report]:
    return list(
        db.scalars(
            select(Report).where(Report.owner_id == current_user.id).order_by(Report.created_at.desc())
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


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    report = _get_owned_report(db, report_id, current_user)
    db.delete(report)
    db.commit()
