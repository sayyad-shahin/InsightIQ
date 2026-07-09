import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatMessage, MessageRole, ResultType
from app.models.dataset import Dataset, DatasetStatus
from app.services import analysis_service
from app.services.ai_service import generate_chat_reply, narrate
from app.services.dataset_service import load_dataframe


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


def rename_chat(db: Session, chat: Chat, title: str) -> Chat:
    chat.title = title
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


def _dataset_context(db: Session, dataset_id: uuid.UUID | None) -> str | None:
    if dataset_id is None:
        return None
    dataset = db.get(Dataset, dataset_id)
    if dataset is None or not dataset.schema_snapshot:
        return None
    columns = ", ".join(col["name"] for col in dataset.schema_snapshot.get("columns", []))
    return f"Dataset '{dataset.name}' with columns: {columns}"


def _load_bound_dataframe(db: Session, dataset_id: uuid.UUID | None):
    """Load the chat's dataset into a DataFrame if it exists and is ready."""
    if dataset_id is None:
        return None, None
    dataset = db.get(Dataset, dataset_id)
    if dataset is None or dataset.status != DatasetStatus.CLEANED:
        return None, dataset.name if dataset else None
    try:
        return load_dataframe(Path(dataset.storage_path), dataset.source_type), dataset.name
    except Exception:  # noqa: BLE001 - fall back to a text answer if the file can't be read
        return None, dataset.name


def _generate_reply(db: Session, chat: Chat, content: str) -> tuple[str, ResultType, dict | None]:
    """Produce a grounded reply from the real dataset, with an optional chart."""
    df, dataset_name = _load_bound_dataframe(db, chat.dataset_id)
    if df is not None:
        result = analysis_service.analyze(df, content)
        text = narrate(content, result.answer, dataset_name)
        rtype = ResultType.CHART if result.chart else ResultType.TEXT
        return text, rtype, result.chart

    # No dataset attached (or not ready): general assistant / graceful guidance.
    context = _dataset_context(db, chat.dataset_id)
    return generate_chat_reply(content, context), ResultType.TEXT, None


def add_message_and_reply(db: Session, chat: Chat, content: str) -> ChatMessage:
    """Persist the user's message, generate a grounded reply, persist and return it."""
    db.add(ChatMessage(chat_id=chat.id, role=MessageRole.USER, content=content))
    # Auto-title a fresh conversation from its first question.
    if chat.title == "New conversation":
        chat.title = content[:60] + ("…" if len(content) > 60 else "")
        db.add(chat)
    db.commit()

    reply_text, result_type, payload = _generate_reply(db, chat, content)

    assistant = ChatMessage(
        chat_id=chat.id,
        role=MessageRole.ASSISTANT,
        content=reply_text,
        result_type=result_type,
        result_payload=payload,
    )
    db.add(assistant)
    db.commit()
    db.refresh(assistant)
    return assistant
