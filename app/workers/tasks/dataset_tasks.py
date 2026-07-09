import uuid
from pathlib import Path

from celery.exceptions import SoftTimeLimitExceeded

from app.core.logging import logger
from app.db.session import SessionLocal
from app.models.dataset import Dataset, DatasetStatus
from app.services.dataset_service import (
    UnsupportedDatasetError,
    build_quality_report,
    build_schema_snapshot,
    load_dataframe,
    write_parsed_artifact,
)
from app.workers.celery_app import celery_app

RETRY_COUNTDOWN_SECONDS = 30


@celery_app.task(name="datasets.process_dataset", bind=True, max_retries=3)
def process_dataset(self, dataset_id: str) -> None:
    """
    Load the raw uploaded file, compute schema + data-quality metadata, and
    transition the dataset's status. Runs off the request/response cycle.

    Failure handling:
      * UnsupportedDatasetError -> permanent parse failure, mark ERROR, no retry.
      * Any other exception -> likely transient (DB blip, disk), retry with
        backoff; after retries are exhausted, persist the failure on the row.
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
            db.add(dataset)
            db.commit()

            # Persist a parsed artifact so analytics/chat don't re-parse the file.
            write_parsed_artifact(df, dataset.storage_path)
            logger.info(f"Dataset {dataset_id} processed: {dataset.row_count} rows")

        except (UnsupportedDatasetError, FileNotFoundError) as exc:
            dataset.status = DatasetStatus.ERROR
            dataset.error_message = str(exc)
            db.add(dataset)
            db.commit()
            logger.warning(f"Dataset {dataset_id} failed to parse: {exc}")

        except SoftTimeLimitExceeded:
            dataset.status = DatasetStatus.ERROR
            dataset.error_message = "Processing timed out"
            db.add(dataset)
            db.commit()
            logger.error(f"Dataset {dataset_id} processing timed out")

        except Exception as exc:  # noqa: BLE001 - transient failure: retry, then persist
            logger.exception(f"Dataset {dataset_id} processing failed (attempt {self.request.retries + 1})")
            try:
                raise self.retry(exc=exc, countdown=RETRY_COUNTDOWN_SECONDS)
            except self.MaxRetriesExceededError:
                dataset.status = DatasetStatus.ERROR
                dataset.error_message = f"Processing failed after retries: {exc}"
                db.add(dataset)
                db.commit()
    finally:
        db.close()
