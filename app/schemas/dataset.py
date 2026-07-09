import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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


class DatasetRename(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CleaningOperations(BaseModel):
    remove_duplicates: bool = False
    fill_missing: bool = False
    drop_empty_rows: bool = False
    convert_types: bool = False
    normalize_dates: bool = False
    trim_whitespace: bool = False
    fill_strategy: Literal["auto", "mean", "median", "zero"] = "auto"


class CleaningPreviewResponse(BaseModel):
    summary: dict[str, Any]
    preview: DatasetPreviewResponse
