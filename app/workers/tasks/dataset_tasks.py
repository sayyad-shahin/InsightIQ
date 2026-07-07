import uuid
from pathlib import Path

from app.core.logging import logger
from app.db.session import SessionLocal
from app.models.dataset import Dataset, DatasetStatus
from app.services.dataset_service import (
    UnsupportedDatasetError,
    build_quality_report,
    build_schema_snapshot,
    load_dataframe,
)
from app.workers.celery_app import celery_app


@celery_app.task(name="datasets.process_dataset", bind=True, max_retries=2)
def process_dataset(self, dataset_id: str) -> None:
    """
    Loads the raw uploaded file, computes schema + data-quality metadata,
    and transitions the dataset's status. Runs off the request/response
    cycle so large files never block an API worker.
    """
    db = SessionLocal()
    try:
        dataset = db.get(Dataset, uuid.UUID(dataset_id))
        if dataset is None:
            logger.warning(f"process_dataset: dataset {dataset_id} not found")
            return

        dataset.status = DatasetStatus.PROCESSING
        db.add(dataset)
        db.commit()

        try:
            df = load_dataframe(Path(dataset.storage_path), dataset.source_type)

            dataset.row_count = len(df)
            dataset.column_count = len(df.columns)
            dataset.schema_snapshot = build_schema_snapshot(df)
            dataset.quality_report = build_quality_report(df)
            dataset.status = DatasetStatus.CLEANED
            dataset.error_message = None

        except UnsupportedDatasetError as exc:
            dataset.status = DatasetStatus.ERROR
            dataset.error_message = str(exc)
            logger.warning(f"Dataset {dataset_id} failed to parse: {exc}")

        except Exception as exc:  # noqa: BLE001 - persist any failure onto the row
            dataset.status = DatasetStatus.ERROR
            dataset.error_message = f"Unexpected error while processing file: {exc}"
            logger.exception(f"Dataset {dataset_id} processing failed")

        db.add(dataset)
        db.commit()

    finally:
        db.close()
