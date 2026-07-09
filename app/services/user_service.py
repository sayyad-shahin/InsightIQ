import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.setting import UserSetting
from app.models.user import AuthProvider, User
from app.schemas.user import UserSignup


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, payload: UserSignup) -> User:
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        auth_provider=AuthProvider.LOCAL,
    )
    db.add(user)
    db.flush()

    db.add(UserSetting(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def get_or_create_google_user(db: Session, email: str, full_name: str) -> User:
    existing = get_user_by_email(db, email)
    if existing:
        return existing

    user = User(
        email=email.lower(),
        full_name=full_name,
        hashed_password=None,
        auth_provider=AuthProvider.GOOGLE,
        is_email_verified=True,
    )
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def set_password(db: Session, user: User, new_password: str) -> None:
    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()


class InvalidCurrentPasswordError(Exception):
    """Raised when a password change is attempted with the wrong current password."""


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not user.hashed_password or not verify_password(current_password, user.hashed_password):
        raise InvalidCurrentPasswordError("Current password is incorrect")
    set_password(db, user, new_password)


def mark_email_verified(db: Session, user: User) -> None:
    user.is_email_verified = True
    db.add(user)
    db.commit()
