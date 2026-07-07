import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
    UserRead,
    UserSignup,
)
from app.services.audit_service import record_action
from app.services.email_service import send_password_reset_email, send_verification_email
from app.services.user_service import (
    authenticate_user,
    create_user,
    get_or_create_google_user,
    get_user_by_email,
    get_user_by_id,
    mark_email_verified,
    set_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, request: Request, db: Session = Depends(get_db)) -> User:
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists"
        )

    user = create_user(db, payload)

    token = create_email_verification_token(user.id)
    send_verification_email(user.email, token)

    record_action(db, "user.signup", user_id=user.id, ip_address=request.client.host if request.client else None)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    record_action(db, "user.login", user_id=user.id, ip_address=request.client.host if request.client else None)
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        subject = decode_token(payload.refresh_token, expected_type="refresh")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from exc

    user = get_user_by_id(db, uuid.UUID(subject))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return _issue_tokens(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    # Stateless JWTs: the client discards its tokens. Present for API symmetry
    # and as the hook point for a future token-blocklist implementation.
    return None


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    user = get_user_by_email(db, payload.email)
    if user and user.auth_provider.value == "local":
        token = create_password_reset_token(user.id)
        send_password_reset_email(user.email, token)

    # Always return the same response to avoid leaking which emails are registered.
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    try:
        subject = decode_token(payload.token, expected_type="password_reset")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
        ) from exc

    user = get_user_by_id(db, uuid.UUID(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    set_password(db, user, payload.new_password)
    record_action(db, "user.password_reset", user_id=user.id)
    return {"message": "Password updated successfully"}


@router.get("/verify-email/{token}", status_code=status.HTTP_200_OK)
def verify_email(token: str, db: Session = Depends(get_db)) -> dict:
    try:
        subject = decode_token(token, expected_type="email_verification")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link"
        ) from exc

    user = get_user_by_id(db, uuid.UUID(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    mark_email_verified(db, user)
    return {"message": "Email verified successfully"}


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
def google_login() -> RedirectResponse:
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured"
        )

    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)) -> RedirectResponse:
    with httpx.Client(timeout=10.0) as client:
        token_resp = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token exchange failed")

        google_access_token = token_resp.json()["access_token"]

        userinfo_resp = client.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {google_access_token}"}
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google profile")

        profile = userinfo_resp.json()

    user = get_or_create_google_user(db, email=profile["email"], full_name=profile.get("name", profile["email"]))
    tokens = _issue_tokens(user)
    record_action(db, "user.login.google", user_id=user.id)

    redirect_url = (
        f"{settings.FRONTEND_URL}/oauth/callback"
        f"?access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )
    return RedirectResponse(redirect_url)
