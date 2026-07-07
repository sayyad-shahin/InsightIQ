import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
)
from app.services.chat_service import (
    add_message_and_reply,
    create_chat,
    get_owned_chat,
    list_chats,
)
from app.services.dataset_service import get_owned_dataset

router = APIRouter(prefix="/chats", tags=["chats"])


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Chat]:
    return list_chats(db, current_user.id)


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


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    chat = _require_owned_chat(db, chat_id, current_user)
    db.delete(chat)
    db.commit()
