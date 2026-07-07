import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import GUID, JSONVariant, Base, TimestampMixin, UUIDMixin, pg_enum

if TYPE_CHECKING:
    from app.models.chat import Chat
    from app.models.forecast import Forecast
    from app.models.report import Report
    from app.models.user import User


class SourceType(str, enum.Enum):
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"
    SQL = "sql"


class DatasetStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    CLEANED = "cleaned"
    ERROR = "error"


class Dataset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "datasets"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(pg_enum(SourceType, "source_type"), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    column_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[DatasetStatus] = mapped_column(
        pg_enum(DatasetStatus, "dataset_status"), default=DatasetStatus.UPLOADED, nullable=False, index=True
    )
    schema_snapshot: Mapped[Optional[dict]] = mapped_column(JSONVariant, nullable=True)
    quality_report: Mapped[Optional[dict]] = mapped_column(JSONVariant, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="datasets")
    chats: Mapped[list["Chat"]] = relationship(back_populates="dataset")
    forecasts: Mapped[list["Forecast"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Dataset {self.name} ({self.status})>"
