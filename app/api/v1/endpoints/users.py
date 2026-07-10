import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.chat import Chat
from app.models.dataset import Dataset
from app.models.forecast import Forecast
from app.models.report import Report
from app.models.user import User
from app.schemas.user import MessageResponse, PasswordChange, UserRead, UserRoleUpdate, UserUpdate
from app.services.audit_service import record_action
from app.services.user_service import InvalidCurrentPasswordError, change_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/me/stats")
def read_my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Lightweight counts for dashboard/profile (avoids downloading full lists)."""

    def count(stmt) -> int:
        return int(db.scalar(stmt) or 0)

    return {
        "datasets": count(select(func.count()).select_from(Dataset).where(Dataset.owner_id == current_user.id)),
        "chats": count(select(func.count()).select_from(Chat).where(Chat.user_id == current_user.id)),
        "forecasts": count(
            select(func.count())
            .select_from(Forecast)
            .join(Dataset, Forecast.dataset_id == Dataset.id)
            .where(Dataset.owner_id == current_user.id)
        ),
        "reports": count(select(func.count()).select_from(Report).where(Report.owner_id == current_user.id)),
    }


@router.post("/me/password", response_model=MessageResponse)
def change_my_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        change_password(db, current_user, payload.current_password, payload.new_password)
    except InvalidCurrentPasswordError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    record_action(db, "user.password_change", user_id=current_user.id)
    db.commit()
    return MessageResponse(message="Password updated successfully")


@router.patch("/me", response_model=UserRead)
def update_current_user(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("", response_model=list[UserRead], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/{user_id}/role", response_model=UserRead, dependencies=[Depends(require_admin)])
def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> User:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.role = payload.role
    db.add(target)
    db.flush()
    record_action(
        db,
        "user.role_updated",
        user_id=current_user.id,
        metadata={"target_user_id": str(user_id), "new_role": payload.role.value},
    )
    db.commit()  # role change + audit row commit together
    db.refresh(target)
    return target
