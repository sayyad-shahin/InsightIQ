import sys

from loguru import logger

from app.core.config import settings


def configure_logging() -> None:
    """Configure loguru sinks. Called once at application startup."""
    logger.remove()
    # Default so log records emitted outside a request context still render.
    logger.configure(extra={"request_id": "-"})

    if settings.is_production:
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[request_id]} | "
            "{name}:{function}:{line} | {message}",
            level="INFO",
            serialize=True,  # structured JSON for log aggregation
            backtrace=False,
            diagnose=False,
        )
    else:
        logger.add(
            sys.stdout,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | "
            "<magenta>{extra[request_id]}</magenta> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            level="DEBUG" if settings.DEBUG else "INFO",
            colorize=True,
        )

    logger.add(
        "logs/insightiq_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[request_id]} | "
        "{name}:{function}:{line} | {message}",
        enqueue=True,  # safe across processes (gunicorn workers / celery)
    )


__all__ = ["logger", "configure_logging"]
