import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.dataset import Dataset


class ForecastModelType(str, enum.Enum):
    PROPHET = "prophet"
    SKLEARN_REGRESSION = "sklearn_regression"


class ForecastStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class Forecast(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "forecasts"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_column: Mapped[str] = mapped_column(String(255), nullable=False)
    model_type: Mapped[ForecastModelType] = mapped_column(
        Enum(ForecastModelType, name="forecast_model_type"), nullable=False
    )
    horizon_periods: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[ForecastStatus] = mapped_column(
        Enum(ForecastStatus, name="forecast_status"), default=ForecastStatus.QUEUED, nullable=False, index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    dataset: Mapped["Dataset"] = relationship(back_populates="forecasts")

    def __repr__(self) -> str:
        return f"<Forecast {self.target_column} ({self.status})>"
