"""
Seed script: creates an initial admin user and a demo analyst user.

Run with:
    python -m app.db.seed
"""

from app.core.logging import logger
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.setting import UserSetting
from app.models.user import AuthProvider, User, UserRole

ADMIN_EMAIL = "admin@insightiq.app"
ADMIN_PASSWORD = "ChangeMe123!"
DEMO_EMAIL = "demo@insightiq.app"
DEMO_PASSWORD = "DemoUser123!"


def seed() -> None:
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == ADMIN_EMAIL).first():
            admin = User(
                email=ADMIN_EMAIL,
                full_name="InsightIQ Admin",
                hashed_password=hash_password(ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                auth_provider=AuthProvider.LOCAL,
                is_active=True,
                is_email_verified=True,
            )
            db.add(admin)
            db.flush()
            db.add(UserSetting(user_id=admin.id))
            logger.info(f"Created admin user: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            logger.info("Admin user already exists, skipping")

        if not db.query(User).filter(User.email == DEMO_EMAIL).first():
            demo = User(
                email=DEMO_EMAIL,
                full_name="Demo Analyst",
                hashed_password=hash_password(DEMO_PASSWORD),
                role=UserRole.ANALYST,
                auth_provider=AuthProvider.LOCAL,
                is_active=True,
                is_email_verified=True,
            )
            db.add(demo)
            db.flush()
            db.add(UserSetting(user_id=demo.id))
            logger.info(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        else:
            logger.info("Demo user already exists, skipping")

        db.commit()
        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
