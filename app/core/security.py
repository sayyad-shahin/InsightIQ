from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

TokenType = Literal["access", "refresh", "email_verification", "password_reset", "oauth_state"]

# bcrypt operates on at most 72 bytes; longer inputs raise in bcrypt >= 4.1, so we
# truncate deterministically. Using bcrypt directly avoids the unmaintained passlib
# shim, which is incompatible with modern bcrypt releases.
_BCRYPT_MAX_BYTES = 72


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(subject: str, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(
        str(user_id), "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(
        str(user_id), "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def create_email_verification_token(user_id: UUID) -> str:
    return _create_token(str(user_id), "email_verification", timedelta(hours=24))


def create_password_reset_token(user_id: UUID) -> str:
    return _create_token(str(user_id), "password_reset", timedelta(hours=1))


def create_oauth_state_token() -> str:
    """Short-lived signed token used as the OAuth2 `state` parameter (CSRF defense)."""
    return _create_token("oauth", "oauth_state", timedelta(minutes=10))


class InvalidTokenError(Exception):
    pass


def decode_token(token: str, expected_type: TokenType) -> str:
    """Decode a JWT and return the subject (user id as string). Raises InvalidTokenError on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise InvalidTokenError("Token is invalid or expired") from exc

    if payload.get("type") != expected_type:
        raise InvalidTokenError(f"Expected a {expected_type} token")

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError("Token missing subject")

    return subject
