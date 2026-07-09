import uuid

from app.core.logging import logger
from app.db.session import SessionLocal
from app.models.dataset import Dataset, DatasetStatus
from app.models.report import Report
from app.services.dataset_service import load_analysis_dataframe
from app.services.report_service import build_report_sections, executive_summary
from app.workers.celery_app import celery_app


@celery_app.task(name="reports.generate_report", bind=True, max_retries=2)
def generate_report(self, report_id: str) -> None:
    """Build a report's sections (with AI insights from the real data) off-request."""
    db = SessionLocal()
    try:
        report = db.get(Report, uuid.UUID(report_id))
        if report is None:
            logger.warning(f"generate_report: report {report_id} not found")
            return

        dataset = db.get(Dataset, report.dataset_id)
        extra = None
        if dataset is not None and dataset.status == DatasetStatus.CLEANED:
            try:
                extra = executive_summary(load_analysis_dataframe(dataset))
            except Exception as exc:  # noqa: BLE001 - insights are best-effort
                logger.warning(f"Report insights unavailable for dataset {report.dataset_id}: {exc}")

        report.sections = build_report_sections(dataset, extra) if dataset else {"overview": {}, "error": "dataset removed"}
        db.add(report)
        db.commit()
        logger.info(f"Report {report_id} generated")
    finally:
        db.close()
