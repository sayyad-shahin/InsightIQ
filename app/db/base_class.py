import enum
import uuid
from datetime import datetime
from typing import Type

from sqlalchemy import JSON, DateTime, Enum, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# --- Portable column types -------------------------------------------------
# GUID renders as a native PostgreSQL UUID in production and as CHAR(32) on
# other backends (e.g. SQLite in the test suite). JSONVariant renders as
# JSONB on PostgreSQL and generic JSON elsewhere. This keeps the production
# schema identical while letting the models run on SQLite for fast tests.
GUID = Uuid
JSONVariant = JSON().with_variant(JSONB(), "postgresql")


def pg_enum(enum_cls: Type[enum.Enum], name: str) -> Enum:
    """
    Build a SQLAlchemy Enum that persists the member *value* (e.g. "analyst"),
    not the member *name* ("ANALYST").

    SQLAlchemy's default is to store the name, which silently diverges from the
    Alembic migration (which declares the Postgres ENUM with lowercase values).
    Using values_callable keeps the ORM, the migration, and the API layer in
    agreement on a single canonical string.
    """
    return Enum(enum_cls, name=name, values_callable=lambda e: [member.value for member in e])


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""

    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(GUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
