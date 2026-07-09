from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings


def _build_engine() -> Engine:
    """
    Build the SQLAlchemy engine.

    Connection pooling arguments only apply to real pooled backends (PostgreSQL).
    SQLite — used by the test suite — rejects pool_size/max_overflow, so we branch
    on the dialect. For in-memory SQLite we pin a single shared connection via
    StaticPool so every session (API requests and eager Celery tasks) sees the
    same database.
    """
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        if ":memory:" in url or "mode=memory" in url:
            return create_engine(
                url,
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
        return create_engine(url, connect_args={"check_same_thread": False}, pool_pre_ping=True)

    return create_engine(
        url,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
    )


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and guarantees cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
