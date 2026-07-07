from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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
