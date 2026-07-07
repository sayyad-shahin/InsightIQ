import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

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
    for field, value in data.items():
        setattr(setting, field, value)
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
