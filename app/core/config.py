from functools import lru_cache
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRET_PLACEHOLDER = "changeme-generate-a-real-64-byte-secret"


class Settings(BaseSettings):
    """
    Application configuration.

    All values are read from environment variables (or a local .env file).
    See .env.example in the backend/ root for the full list of required keys.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Application ---
    APP_NAME: str = "InsightIQ"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- Security / JWT ---
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Database ---
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    # Run tasks inline (no broker/worker) — enabled by the test suite.
    CELERY_TASK_ALWAYS_EAGER: bool = False

    # --- CORS ---
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- File storage ---
    UPLOAD_DIR: str = "./storage/uploads"
    REPORT_DIR: str = "./storage/reports"
    MAX_UPLOAD_SIZE_MB: int = 100

    # --- AI providers ---
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # --- Email (password reset / verification) ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@insightiq.app"
    FRONTEND_URL: str = "http://localhost:5173"

    # --- Google OAuth ---
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # --- Rate limiting ---
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_UPLOAD: str = "10/minute"
    RATE_LIMIT_CHAT: str = "20/minute"
    RATE_LIMIT_COMPUTE: str = "30/minute"  # heavy pandas endpoints (analytics/stats/clean/forecast/report)
    # Backing store for rate-limit counters. Leave empty for in-process memory
    # (single worker / tests); set to the Redis URL so limits are shared across
    # gunicorn workers in production.
    RATE_LIMIT_STORAGE_URI: str = ""

    # --- Monitoring (Sentry) — no-op when DSN is empty ---
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # --- Caching ---
    CACHE_TTL_SECONDS: int = 900
    CACHE_MEMORY_MAX_ENTRIES: int = 512  # bound the in-process fallback cache

    # --- Limits ---
    MAX_PREFERENCES_BYTES: int = 64 * 1024  # reject oversized settings.preferences payloads

    # --- Auth cookies ---
    COOKIE_SAMESITE: str = "lax"  # lax | strict | none  (use "none" for cross-site SPA+API)
    COOKIE_SECURE: bool | None = None  # None -> auto (secure in production); override explicitly if needed
    COOKIE_DOMAIN: str = ""  # empty -> host-only cookie (correct for localhost)
    COOKIE_PATH: str = "/"

    # --- Security headers (set on every response; toggle/override per deployment) ---
    SECURITY_HEADERS_ENABLED: bool = True
    SECURITY_HSTS: str = "max-age=63072000; includeSubDomains"  # only sent in production
    SECURITY_CSP: str = (
        "default-src 'self'; img-src 'self' data: blob:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; "
        "connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'"
    )
    SECURITY_FRAME_OPTIONS: str = "DENY"
    SECURITY_CONTENT_TYPE_OPTIONS: str = "nosniff"
    SECURITY_REFERRER_POLICY: str = "strict-origin-when-cross-origin"
    SECURITY_PERMISSIONS_POLICY: str = "geolocation=(), microphone=(), camera=()"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        return self.is_production if self.COOKIE_SECURE is None else self.COOKIE_SECURE

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        """Accept CORS origins as a JSON array or a comma-separated string."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                return raw  # let pydantic parse the JSON list
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return value

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: object) -> object:
        """Normalize legacy 'postgres://' scheme to a SQLAlchemy-compatible driver URL."""
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)
        return value

    @model_validator(mode="after")
    def _guard_production_secrets(self) -> "Settings":
        """Fail fast if a production process boots with an insecure or missing secret."""
        if self.is_production:
            if not self.SECRET_KEY or self.SECRET_KEY == INSECURE_SECRET_PLACEHOLDER:
                raise ValueError(
                    "SECRET_KEY must be set to a strong, unique value in production "
                    '(generate with: python -c "import secrets; print(secrets.token_urlsafe(64))").'
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so env parsing only happens once per process."""
    return Settings()


settings = get_settings()
