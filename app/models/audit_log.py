import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import GUID, JSONVariant, Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(UUIDMixin, Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    log_metadata: Mapped[Optional[dict]] = mapped_column(JSONVariant, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action}>"
