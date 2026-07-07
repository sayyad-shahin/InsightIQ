import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.dataset import DatasetStatus, SourceType


class DatasetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    source_type: SourceType
    status: DatasetStatus
    row_count: int | None
    column_count: int | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class DatasetDetail(DatasetRead):
    schema_snapshot: dict[str, Any] | None
    quality_report: dict[str, Any] | None


class DatasetPreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    total_rows: int
    previewed_rows: int
