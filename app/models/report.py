import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import GUID, JSONVariant, Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.dataset import Dataset
    from app.models.user import User


class Report(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        GUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    sections: Mapped[Optional[dict]] = mapped_column(JSONVariant, nullable=True)

    dataset: Mapped["Dataset"] = relationship(back_populates="reports")
    owner: Mapped["User"] = relationship(back_populates="reports")

    def __repr__(self) -> str:
        return f"<Report {self.title}>"
