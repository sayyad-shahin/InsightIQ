import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDMixin, pg_enum

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.chat import Chat
    from app.models.dataset import Dataset
    from app.models.report import Report
    from app.models.setting import UserSetting


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class AuthProvider(str, enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole, "user_role"), default=UserRole.ANALYST, nullable=False
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        pg_enum(AuthProvider, "auth_provider"), default=AuthProvider.LOCAL, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    datasets: Mapped[list["Dataset"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    chats: Mapped[list["Chat"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")
    setting: Mapped[Optional["UserSetting"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"
