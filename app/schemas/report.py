import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    dataset_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    title: str
    storage_path: str | None
    created_at: datetime
    updated_at: datetime


class ReportDetail(ReportRead):
    sections: dict[str, Any] | None
