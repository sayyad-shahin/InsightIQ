import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class ThemePreference(str, enum.Enum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class UserSetting(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    theme: Mapped[ThemePreference] = mapped_column(
        Enum(ThemePreference, name="theme_preference"), default=ThemePreference.SYSTEM, nullable=False
    )
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship(back_populates="setting")

    def __repr__(self) -> str:
        return f"<UserSetting user={self.user_id}>"
