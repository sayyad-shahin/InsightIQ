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
from app.core.limiter import limiter
from app.core.logging import configure_logging, logger

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"{settings.APP_NAME} starting up in {settings.APP_ENV} mode")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
