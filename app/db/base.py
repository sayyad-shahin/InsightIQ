"""
Import all ORM models here so Alembic's autogenerate can discover them
via Base.metadata. This module is imported by alembic/env.py.
"""

from app.db.base_class import Base  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.chat import Chat, ChatMessage  # noqa: F401
from app.models.dataset import Dataset  # noqa: F401
from app.models.forecast import Forecast  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.setting import UserSetting  # noqa: F401
from app.models.user import User  # noqa: F401
