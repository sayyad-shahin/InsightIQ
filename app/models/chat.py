import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.dataset import Dataset
    from app.models.user import User


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ResultType(str, enum.Enum):
    TEXT = "text"
    TABLE = "table"
    CHART = "chart"
    NONE = "none"


class Chat(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chats"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New conversation", nullable=False)

    user: Mapped["User"] = relationship(back_populates="chats")
    dataset: Mapped[Optional["Dataset"]] = relationship(back_populates="chats")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )

    def __repr__(self) -> str:
        return f"<Chat {self.title}>"


class ChatMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, name="message_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    generated_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_type: Mapped[ResultType] = mapped_column(
        Enum(ResultType, name="result_type"), default=ResultType.NONE, nullable=False
    )
    result_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    chat: Mapped["Chat"] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        return f"<ChatMessage {self.role}>"
