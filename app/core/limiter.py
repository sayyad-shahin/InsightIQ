from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Single application-wide limiter. Endpoints import this instance and add
# per-route limits with @limiter.limit(...). A Redis storage URI shares counters
# across worker processes in production; empty falls back to in-process memory.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or "memory://",
)
