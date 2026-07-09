import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import encrypt_secret
from app.models.setting import UserSetting
from app.schemas.setting import SettingUpdate


def get_or_create_settings(db: Session, user_id: uuid.UUID) -> UserSetting:
    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == user_id))
    if setting is None:
        setting = UserSetting(user_id=user_id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def update_settings(db: Session, setting: UserSetting, payload: SettingUpdate) -> UserSetting:
    data = payload.model_dump(exclude_unset=True)

    if "preferences" in data:
        incoming = data.pop("preferences") or {}
        setting.preferences = _merge_preferences(setting.preferences, incoming)

    for field, value in data.items():
        setattr(setting, field, value)

    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


def _merge_preferences(existing: dict[str, Any] | None, incoming: dict[str, Any]) -> dict[str, Any]:
    """Merge preference patches; encrypt any provided API keys before storing."""
    merged = dict(existing or {})
    if "api_keys" in incoming:
        provided = incoming.pop("api_keys") or {}
        stored = dict(merged.get("api_keys") or {})
        for provider, value in provided.items():
            stored[provider] = encrypt_secret(value) if value else ""
        merged["api_keys"] = stored
    merged.update(incoming)
    return merged


def redact_settings(setting: UserSetting) -> dict[str, Any]:
    """Response view: strip encrypted secrets, expose only which keys are set."""
    prefs = dict(setting.preferences or {})
    api_keys = prefs.pop("api_keys", {}) or {}
    prefs["api_keys_set"] = {provider: bool(value) for provider, value in api_keys.items()}
    return {"theme": setting.theme, "language": setting.language, "preferences": prefs}
