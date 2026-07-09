import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat import MessageRole, ResultType


class ChatCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=255)
    dataset_id: uuid.UUID | None = None


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class ChatRename(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: MessageRole
    content: str
    result_type: ResultType
    result_payload: dict[str, Any] | None
    created_at: datetime


class ChatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    dataset_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ChatDetail(ChatRead):
    messages: list[ChatMessageRead]
