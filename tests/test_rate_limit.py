"""
Rate-limiting tests.

The production compute/auth/upload limits are read from settings at import time
(`@limiter.limit(settings.RATE_LIMIT_COMPUTE)`), and conftest raises every limit
to 100000/minute so the rest of the suite is never throttled. That makes it
impossible to trip a 429 against the already-imported app. So here we exercise
the exact SlowAPI wiring the real routes use — shared Limiter + SlowAPIMiddleware
+ the 429 handler — with a deliberately low limit, and assert the mechanism
returns 429 once the window is exhausted. We also assert the real settings carry
sane, non-empty limit strings for the dedicated compute routes.
"""

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings


def _build_app(limit: str) -> TestClient:
    app = FastAPI()
    limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.get("/compute")
    @limiter.limit(limit)
    def compute(request: Request):  # slowapi requires the Request param
        return {"ok": True}

    return TestClient(app)


def test_compute_route_returns_429_when_limit_exceeded():
    client = _build_app("2/minute")
    assert client.get("/compute").status_code == 200
    assert client.get("/compute").status_code == 200
    # Third request within the window is rejected.
    blocked = client.get("/compute")
    assert blocked.status_code == 429


def test_compute_limit_is_configured():
    # The dedicated heavy-endpoint limit must be a real, non-empty limit string.
    assert settings.RATE_LIMIT_COMPUTE
    assert "/" in settings.RATE_LIMIT_COMPUTE
