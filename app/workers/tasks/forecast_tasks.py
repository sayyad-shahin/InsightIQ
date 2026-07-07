import uuid
from pathlib import Path

from app.core.logging import logger
from app.db.session import SessionLocal
from app.models.dataset import Dataset
from app.models.forecast import Forecast, ForecastStatus
from app.services.dataset_service import UnsupportedDatasetError, load_dataframe
from app.services.forecast_service import ForecastError, compute_forecast
from app.workers.celery_app import celery_app

RETRY_COUNTDOWN_SECONDS = 30


@celery_app.task(name="forecasts.run_forecast", bind=True, max_retries=2)
def run_forecast(self, forecast_id: str) -> None:
    """Load the dataset, fit the requested model, and persist the forecast result."""
    db = SessionLocal()
    try:
        forecast = db.get(Forecast, uuid.UUID(forecast_id))
        if forecast is None:
            logger.warning(f"run_forecast: forecast {forecast_id} not found")
            return

        forecast.status = ForecastStatus.RUNNING
        db.add(forecast)
        db.commit()

        dataset = db.get(Dataset, forecast.dataset_id)
        if dataset is None:
            forecast.status = ForecastStatus.FAILED
            forecast.error_message = "Source dataset no longer exists"
            db.add(forecast)
            db.commit()
            return

        try:
            df = load_dataframe(Path(dataset.storage_path), dataset.source_type)
            result = compute_forecast(
                df, forecast.target_column, forecast.model_type, forecast.horizon_periods
            )
            forecast.result = result
            forecast.status = ForecastStatus.DONE
            forecast.error_message = None
            db.add(forecast)
            db.commit()
            logger.info(f"Forecast {forecast_id} completed ({result.get('model_used')})")

        except (ForecastError, UnsupportedDatasetError, FileNotFoundError) as exc:
            forecast.status = ForecastStatus.FAILED
            forecast.error_message = str(exc)
            db.add(forecast)
            db.commit()
            logger.warning(f"Forecast {forecast_id} failed: {exc}")

        except Exception as exc:  # noqa: BLE001 - transient: retry then persist failure
            logger.exception(f"Forecast {forecast_id} errored (attempt {self.request.retries + 1})")
            try:
                raise self.retry(exc=exc, countdown=RETRY_COUNTDOWN_SECONDS)
            except self.MaxRetriesExceededError:
                forecast.status = ForecastStatus.FAILED
                forecast.error_message = f"Failed after retries: {exc}"
                db.add(forecast)
                db.commit()
    finally:
        db.close()
