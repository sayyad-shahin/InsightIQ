"""
Optional Sentry integration. No-op when SENTRY_DSN is empty or the SDK isn't
installed, so local development and tests are never affected.
"""

from __future__ import annotations

from app.core.config import settings
from app.core.logging import logger


def init_sentry() -> None:
    if not settings.SENTRY_DSN:
        logger.info("Sentry disabled (no SENTRY_DSN configured)")
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; skipping")
        return

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        send_default_pii=False,
    )
    logger.info(f"Sentry initialized (env={settings.APP_ENV}, traces={settings.SENTRY_TRACES_SAMPLE_RATE})")
