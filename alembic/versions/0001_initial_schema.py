"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = postgresql.ENUM("admin", "analyst", "viewer", name="user_role")
    auth_provider = postgresql.ENUM("local", "google", name="auth_provider")
    source_type = postgresql.ENUM("csv", "excel", "pdf", "sql", name="source_type")
    dataset_status = postgresql.ENUM("uploaded", "processing", "cleaned", "error", name="dataset_status")
    message_role = postgresql.ENUM("user", "assistant", name="message_role")
    result_type = postgresql.ENUM("text", "table", "chart", "none", name="result_type")
    forecast_model_type = postgresql.ENUM("prophet", "sklearn_regression", name="forecast_model_type")
    forecast_status = postgresql.ENUM("queued", "running", "done", "failed", name="forecast_status")
    theme_preference = postgresql.ENUM("light", "dark", "system", name="theme_preference")

    bind = op.get_bind()
    for enum in (
        user_role, auth_provider, source_type, dataset_status,
        message_role, result_type, forecast_model_type, forecast_status, theme_preference,
    ):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="analyst"),
        sa.Column("auth_provider", auth_provider, nullable=False, server_default="local"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("is_email_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("theme", theme_preference, nullable=False, server_default="system"),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("preferences", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", source_type, nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("row_count", sa.Integer, nullable=True),
        sa.Column("column_count", sa.Integer, nullable=True),
        sa.Column("status", dataset_status, nullable=False, server_default="uploaded"),
        sa.Column("schema_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("quality_report", postgresql.JSONB, nullable=True),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_datasets_owner_id", "datasets", ["owner_id"])
    op.create_index("ix_datasets_status", "datasets", ["status"])

    op.create_table(
        "chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False, server_default="New conversation"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chats_user_id", "chats", ["user_id"])
    op.create_index("ix_chats_dataset_id", "chats", ["dataset_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", message_role, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("generated_code", sa.Text, nullable=True),
        sa.Column("result_type", result_type, nullable=False, server_default="none"),
        sa.Column("result_payload", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"])

    op.create_table(
        "forecasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_column", sa.String(255), nullable=False),
        sa.Column("model_type", forecast_model_type, nullable=False),
        sa.Column("horizon_periods", sa.Integer, nullable=False, server_default="30"),
        sa.Column("result", postgresql.JSONB, nullable=True),
        sa.Column("status", forecast_status, nullable=False, server_default="queued"),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_forecasts_dataset_id", "forecasts", ["dataset_id"])
    op.create_index("ix_forecasts_status", "forecasts", ["status"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=True),
        sa.Column("sections", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_reports_dataset_id", "reports", ["dataset_id"])
    op.create_index("ix_reports_owner_id", "reports", ["owner_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("log_metadata", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("reports")
    op.drop_table("forecasts")
    op.drop_table("chat_messages")
    op.drop_table("chats")
    op.drop_table("datasets")
    op.drop_table("settings")
    op.drop_table("users")

    for enum_name in (
        "theme_preference", "forecast_status", "forecast_model_type",
        "result_type", "message_role", "dataset_status", "source_type",
        "auth_provider", "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
