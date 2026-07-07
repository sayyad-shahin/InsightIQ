import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.forecast import ForecastModelType, ForecastStatus


class ForecastCreate(BaseModel):
    dataset_id: uuid.UUID
    target_column: str = Field(min_length=1, max_length=255)
    model_type: ForecastModelType = ForecastModelType.SKLEARN_REGRESSION
    horizon_periods: int = Field(default=30, ge=1, le=3650)


class ForecastRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    target_column: str
    model_type: ForecastModelType
    horizon_periods: int
    status: ForecastStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class ForecastDetail(ForecastRead):
    result: dict[str, Any] | None
