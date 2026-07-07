import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatMessage, MessageRole, ResultType
from app.models.dataset import Dataset
from app.services.ai_service import generate_chat_reply


def create_chat(db: Session, user_id: uuid.UUID, title: str, dataset_id: uuid.UUID | None) -> Chat:
    chat = Chat(user_id=user_id, title=title, dataset_id=dataset_id)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


def list_chats(db: Session, user_id: uuid.UUID) -> list[Chat]:
    return list(
        db.scalars(select(Chat).where(Chat.user_id == user_id).order_by(Chat.created_at.desc()))
    )


def get_owned_chat(db: Session, chat_id: uuid.UUID, user_id: uuid.UUID) -> Chat | None:
    chat = db.get(Chat, chat_id)
    if chat is None or chat.user_id != user_id:
        return None
    return chat


def _dataset_context(db: Session, dataset_id: uuid.UUID | None) -> str | None:
    if dataset_id is None:
        return None
    dataset = db.get(Dataset, dataset_id)
    if dataset is None or not dataset.schema_snapshot:
        return None
    columns = ", ".join(col["name"] for col in dataset.schema_snapshot.get("columns", []))
    return f"Dataset '{dataset.name}' with columns: {columns}"


def add_message_and_reply(db: Session, chat: Chat, content: str) -> ChatMessage:
    """Persist the user's message, generate an assistant reply, persist and return it."""
    db.add(ChatMessage(chat_id=chat.id, role=MessageRole.USER, content=content))
    db.commit()

    context = _dataset_context(db, chat.dataset_id)
    reply_text = generate_chat_reply(content, context)

    assistant = ChatMessage(
        chat_id=chat.id,
        role=MessageRole.ASSISTANT,
        content=reply_text,
        result_type=ResultType.TEXT,
    )
    db.add(assistant)
    db.commit()
    db.refresh(assistant)
    return assistant
