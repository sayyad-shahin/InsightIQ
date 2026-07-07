"""
Test fixtures.

These tests run against a real PostgreSQL instance, not SQLite, because the
schema uses Postgres-native JSONB and UUID column types that SQLite cannot
represent. Point TEST_DATABASE_URL at a disposable database before running
pytest, e.g.:

    export TEST_DATABASE_URL=postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq_test
    pytest

The docker-compose.test.yml service (see infra/) spins up exactly this.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq_test",
    ),
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

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
