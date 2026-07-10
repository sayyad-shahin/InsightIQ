import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings
from app.models.setting import ThemePreference


class SettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: ThemePreference
    language: str
    preferences: dict[str, Any] | None


class SettingUpdate(BaseModel):
    theme: ThemePreference | None = None
    language: str | None = Field(default=None, min_length=2, max_length=16)
    preferences: dict[str, Any] | None = None

    @field_validator("preferences")
    @classmethod
    def _limit_preferences_size(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None:
            size = len(json.dumps(value, default=str).encode("utf-8"))
            if size > settings.MAX_PREFERENCES_BYTES:
                raise ValueError(
                    f"preferences payload too large ({size} bytes; max {settings.MAX_PREFERENCES_BYTES})"
                )
        return value
