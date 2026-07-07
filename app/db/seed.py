"""
Seed script: creates an initial admin user (and an optional demo analyst).

Credentials are read from the environment so real secrets never live in source:
    SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEMO_EMAIL, SEED_DEMO_PASSWORD

Run with:
    python -m app.db.seed
"""

import os

from sqlalchemy import select

from app.core.logging import logger
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.setting import UserSetting
from app.models.user import AuthProvider, User, UserRole

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@insightiq.app")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
DEMO_EMAIL = os.environ.get("SEED_DEMO_EMAIL", "demo@insightiq.app")
DEMO_PASSWORD = os.environ.get("SEED_DEMO_PASSWORD", "DemoUser123!")


def _ensure_user(db, email: str, password: str, full_name: str, role: UserRole) -> None:
    if db.scalar(select(User).where(User.email == email.lower())):
        logger.info(f"User {email} already exists, skipping")
        return
    user = User(
        email=email.lower(),
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
        auth_provider=AuthProvider.LOCAL,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    logger.info(f"Created {role.value} user: {email}")


def seed() -> None:
    if not os.environ.get("SEED_ADMIN_PASSWORD"):
        logger.warning("SEED_ADMIN_PASSWORD not set; using an insecure default. Change it immediately.")
    db = SessionLocal()
    try:
        _ensure_user(db, ADMIN_EMAIL, ADMIN_PASSWORD, "InsightIQ Admin", UserRole.ADMIN)
        _ensure_user(db, DEMO_EMAIL, DEMO_PASSWORD, "Demo Analyst", UserRole.ANALYST)
        db.commit()
        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
