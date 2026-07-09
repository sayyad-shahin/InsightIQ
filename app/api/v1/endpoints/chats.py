import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.chat import Chat, ChatMessage
from app.models.user import User
from app.schemas.chat import (
    ChatCreate,
    ChatDetail,
    ChatMessageCreate,
    ChatMessageRead,
    ChatRead,
    ChatRename,
)
from app.services.chat_service import (
    add_message_and_reply,
    create_chat,
    get_owned_chat,
    list_chats,
    rename_chat,
)
from app.services.dataset_service import get_owned_dataset

router = APIRouter(prefix="/chats", tags=["chats"])


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "role": message.role.value,
        "content": message.content,
        "result_type": message.result_type.value,
        "result_payload": message.result_payload,
        "created_at": message.created_at.isoformat(),
    }


def _chunk_words(text: str, size: int = 4):
    words = text.split(" ")
    for i in range(0, len(words), size):
        yield " ".join(words[i : i + size]) + (" " if i + size < len(words) else "")


@router.post("", response_model=ChatRead, status_code=status.HTTP_201_CREATED)
def start_chat(
    payload: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    if payload.dataset_id is not None and get_owned_dataset(db, payload.dataset_id, current_user.id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return create_chat(db, current_user.id, payload.title, payload.dataset_id)


@router.get("", response_model=list[ChatRead])
def get_chats(
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Chat]:
    return list_chats(db, current_user.id, limit=limit, offset=offset)


def _require_owned_chat(db: Session, chat_id: uuid.UUID, user: User) -> Chat:
    chat = get_owned_chat(db, chat_id, user.id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


@router.get("/{chat_id}", response_model=ChatDetail)
def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    return _require_owned_chat(db, chat_id, current_user)


@router.patch("/{chat_id}", response_model=ChatRead)
def rename_conversation(
    chat_id: uuid.UUID,
    payload: ChatRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    chat = _require_owned_chat(db, chat_id, current_user)
    return rename_chat(db, chat, payload.title)


@router.post("/{chat_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_CHAT)
def post_message(
    chat_id: uuid.UUID,
    payload: ChatMessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessage:
    chat = _require_owned_chat(db, chat_id, current_user)
    return add_message_and_reply(db, chat, payload.content)


@router.post("/{chat_id}/messages/stream")
@limiter.limit(settings.RATE_LIMIT_CHAT)
def stream_message(
    chat_id: uuid.UUID,
    payload: ChatMessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """
    Server-sent-events stream of the assistant reply. The reply is computed and
    persisted up front (so the DB session isn't used inside the generator), then
    the text is streamed in word chunks followed by a final `done` event that
    carries the full persisted message (including any chart payload).
    """
    chat = _require_owned_chat(db, chat_id, current_user)
    assistant = add_message_and_reply(db, chat, payload.content)
    message = _serialize_message(assistant)
    text = assistant.content

    def event_stream():
        for chunk in _chunk_words(text):
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'message': message})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    chat = _require_owned_chat(db, chat_id, current_user)
    db.delete(chat)
    db.commit()
