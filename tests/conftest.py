"""
Test fixtures.

By default the suite runs against an in-memory SQLite database so it needs no
external services. The models use portable column types (see app/db/base_class),
so the same schema builds on SQLite and PostgreSQL. To run the suite against a
real PostgreSQL instance (recommended in CI before release), export:

    export TEST_DATABASE_URL=postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq_test
"""

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0123456789abcdef")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:"))
# Keep rate limiting effectively disabled during tests so bulk requests never 429.
os.environ.setdefault("RATE_LIMIT_DEFAULT", "100000/minute")
os.environ.setdefault("RATE_LIMIT_AUTH", "100000/minute")
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "1")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

if settings.DATABASE_URL.startswith("sqlite"):
    # StaticPool keeps a single shared connection so every session sees the same
    # in-memory database across the TestClient's request threads.
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
