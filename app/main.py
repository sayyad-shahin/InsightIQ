import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE
from app.core.limiter import limiter
from app.core.logging import configure_logging, logger
from app.core.monitoring import init_sentry

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

configure_logging()
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"{settings.APP_NAME} starting up in {settings.APP_ENV} mode")
    # Log the effective CORS config so Render's logs confirm what was loaded.
    logger.info(f"CORS allow_origins={settings.CORS_ORIGINS} allow_origin_regex={settings.CORS_ORIGIN_REGEX!r}")
    yield
    logger.info(f"{settings.APP_NAME} shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI Enterprise Decision Intelligence Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# --- Rate limiting (shared limiter; middleware enforces the global default) ---
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Attach configurable security headers to every response."""
    response = await call_next(request)
    if settings.SECURITY_HEADERS_ENABLED:
        h = response.headers
        h.setdefault("X-Content-Type-Options", settings.SECURITY_CONTENT_TYPE_OPTIONS)
        h.setdefault("X-Frame-Options", settings.SECURITY_FRAME_OPTIONS)
        h.setdefault("Referrer-Policy", settings.SECURITY_REFERRER_POLICY)
        h.setdefault("Permissions-Policy", settings.SECURITY_PERMISSIONS_POLICY)
        if settings.SECURITY_CSP:
            h.setdefault("Content-Security-Policy", settings.SECURITY_CSP)
        # HSTS only over HTTPS (production) to avoid breaking local http.
        if settings.is_production and settings.SECURITY_HSTS:
            h.setdefault("Strict-Transport-Security", settings.SECURITY_HSTS)
    return response


@app.middleware("http")
async def csrf_protect(request: Request, call_next):
    """
    Double-submit CSRF for cookie-authenticated, state-changing requests. Skipped
    when the caller uses an Authorization header (not CSRF-able) or has no auth
    cookie yet (e.g. login/signup).
    """
    path = request.url.path
    # Auth bootstrap endpoints (login/signup/refresh/logout/reset) establish or
    # rotate the session and are exempt — they can't carry a CSRF token yet.
    if request.method not in SAFE_METHODS and path.startswith("/api") and not path.startswith("/api/v1/auth"):
        if not request.headers.get("authorization"):
            cookie_auth = request.cookies.get(ACCESS_COOKIE) or request.cookies.get(REFRESH_COOKIE)
            if cookie_auth:
                header = request.headers.get("x-csrf-token")
                cookie = request.cookies.get(CSRF_COOKIE)
                if not header or not cookie or header != cookie:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"message": "CSRF token missing or invalid"},
                    )
    return await call_next(request)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:12])
    start_time = time.perf_counter()
    with logger.contextualize(request_id=request_id):
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                f"Unhandled error: {request.method} {request.url.path} ({duration_ms:.1f}ms)"
            )
            raise
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)"
        )
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"
    response.headers["X-Request-ID"] = request_id
    return response


# CORS is added LAST so it is the OUTERMOST middleware: every response — including
# error responses short-circuited by the CSRF/auth middleware above (e.g. a 403) —
# passes back through it and receives Access-Control-Allow-Origin. Added earlier it
# would sit inside csrf_protect, and CSRF 403s would reach the browser without CORS
# headers, surfacing as a misleading "CORS blocked" error.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"message": "Rate limit exceeded. Please slow down.", "detail": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_errors(exc), "message": "Validation failed"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Internal server error"},
    )


def jsonable_errors(exc: RequestValidationError) -> list:
    """Strip non-serializable context (e.g. exception objects) from validation errors."""
    cleaned = []
    for err in exc.errors():
        cleaned.append({k: v for k, v in err.items() if k != "ctx"})
    return cleaned


@app.get("/api/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "environment": settings.APP_ENV}


@app.get("/health/live", tags=["health"])
def health_live() -> dict:
    """Liveness: the process is up. Never touches dependencies."""
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
def health_ready() -> JSONResponse:
    """Readiness: verify PostgreSQL and Redis before accepting traffic."""
    from sqlalchemy import text

    from app.db.session import engine

    checks = {"database": False, "redis": False}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Readiness: database check failed: {exc}")

    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.5, socket_timeout=0.5)
        client.ping()
        checks["redis"] = True
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Readiness: redis check failed: {exc}")

    ready = all(checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ready" if ready else "not_ready", "checks": checks},
    )


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
