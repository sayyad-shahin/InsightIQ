from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.setting import SettingRead, SettingUpdate
from app.services.settings_service import get_or_create_settings, redact_settings, update_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/me", response_model=SettingRead)
def read_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return redact_settings(get_or_create_settings(db, current_user.id))


@router.patch("/me", response_model=SettingRead)
def update_my_settings(
    payload: SettingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    setting = get_or_create_settings(db, current_user.id)
    return redact_settings(update_settings(db, setting, payload))
