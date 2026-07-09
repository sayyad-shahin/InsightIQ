import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.logging import logger
from app.db.session import get_db
from app.models.dataset import Dataset
from app.models.forecast import Forecast
from app.models.user import User
from app.schemas.forecast import ForecastCreate, ForecastDetail, ForecastRead
from app.services.dataset_service import get_owned_dataset
from app.workers.tasks.forecast_tasks import run_forecast

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.post("", response_model=ForecastRead, status_code=status.HTTP_201_CREATED)
def create_forecast(
    payload: ForecastCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Forecast:
    dataset = get_owned_dataset(db, payload.dataset_id, current_user.id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    forecast = Forecast(
        dataset_id=dataset.id,
        target_column=payload.target_column,
        model_type=payload.model_type,
        horizon_periods=payload.horizon_periods,
    )
    db.add(forecast)
    db.commit()
    db.refresh(forecast)

    try:
        run_forecast.delay(str(forecast.id))
    except Exception as exc:  # noqa: BLE001 - broker down shouldn't fail creation
        logger.error(f"Failed to enqueue forecast {forecast.id}: {exc}")

    return forecast


def _owned_forecast_query(user_id: uuid.UUID):
    # A forecast is owned transitively through its dataset's owner.
    return (
        select(Forecast)
        .join(Dataset, Forecast.dataset_id == Dataset.id)
        .where(Dataset.owner_id == user_id)
    )


@router.get("", response_model=list[ForecastRead])
def list_forecasts(
    dataset_id: uuid.UUID | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Forecast]:
    query = _owned_forecast_query(current_user.id)
    if dataset_id is not None:
        query = query.where(Forecast.dataset_id == dataset_id)
    return list(db.scalars(query.order_by(Forecast.created_at.desc()).offset(offset).limit(limit)))


def _get_owned_forecast(db: Session, forecast_id: uuid.UUID, user: User) -> Forecast:
    forecast = db.scalar(_owned_forecast_query(user.id).where(Forecast.id == forecast_id))
    if forecast is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")
    return forecast


@router.get("/{forecast_id}", response_model=ForecastDetail)
def get_forecast(
    forecast_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Forecast:
    return _get_owned_forecast(db, forecast_id, current_user)


@router.delete("/{forecast_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_forecast(
    forecast_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    forecast = _get_owned_forecast(db, forecast_id, current_user)
    db.delete(forecast)
    db.commit()
