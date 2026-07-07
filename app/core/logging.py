import sys

from loguru import logger

from app.core.config import settings


def configure_logging() -> None:
    """Configure loguru sinks. Called once at application startup."""
    logger.remove()

    if settings.APP_ENV == "production":
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
            level="INFO",
            serialize=True,
        )
    else:
        logger.add(
            sys.stdout,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            level="DEBUG",
            colorize=True,
        )

    logger.add(
        "logs/insightiq_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
    )


__all__ = ["logger", "configure_logging"]
