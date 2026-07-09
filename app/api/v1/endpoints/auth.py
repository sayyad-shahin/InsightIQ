import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.core.limiter import limiter
from app.core.logging import logger
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    create_email_verification_token,
    create_oauth_state_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    MessageResponse,
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


def _issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


def _parse_user_id(subject: str) -> uuid.UUID:
    """Convert a token subject to a UUID, mapping malformed values to 401 (not 500)."""
    try:
        return uuid.UUID(subject)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject"
        ) from exc


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def signup(payload: UserSignup, request: Request, db: Session = Depends(get_db)) -> User:
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists"
        )

    user = create_user(db, payload)

    token = create_email_verification_token(user.id)
    send_verification_email(user.email, token)

    record_action(db, "user.signup", user_id=user.id, ip_address=request.client.host if request.client else None)
    db.commit()
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def login(
    payload: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)
) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    record_action(db, "user.login", user_id=user.id, ip_address=request.client.host if request.client else None)
    db.commit()
    tokens = _issue_tokens(user)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request, response: Response, db: Session = Depends(get_db), payload: RefreshTokenRequest | None = None
) -> TokenResponse:
    # Prefer the httpOnly refresh cookie (browser); accept a body token for API clients.
    token = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token provided")
    try:
        subject = decode_token(token, expected_type="refresh")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from exc

    user = get_user_by_id(db, _parse_user_id(subject))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    tokens = _issue_tokens(user)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_auth_cookies(response)
    return None


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
) -> MessageResponse:
    user = get_user_by_email(db, payload.email)
    if user and user.auth_provider.value == "local":
        token = create_password_reset_token(user.id)
        send_password_reset_email(user.email, token)

    # Always return the same response to avoid leaking which emails are registered.
    return MessageResponse(message="If an account with that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def reset_password(
    payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)
) -> MessageResponse:
    try:
        subject = decode_token(payload.token, expected_type="password_reset")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
        ) from exc

    user = get_user_by_id(db, _parse_user_id(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    set_password(db, user, payload.new_password)
    record_action(db, "user.password_reset", user_id=user.id)
    db.commit()
    return MessageResponse(message="Password updated successfully")


@router.get("/verify-email/{token}", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        subject = decode_token(token, expected_type="email_verification")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link"
        ) from exc

    user = get_user_by_id(db, _parse_user_id(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    mark_email_verified(db, user)
    return MessageResponse(message="Email verified successfully")


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _require_google_oauth_configured() -> None:
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured"
        )


@router.get("/google/login")
def google_login() -> RedirectResponse:
    _require_google_oauth_configured()

    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        # Signed, short-lived state token defends the callback against CSRF.
        "state": create_oauth_state_token(),
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    _require_google_oauth_configured()

    try:
        decode_token(state, expected_type="oauth_state")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OAuth state"
        ) from exc

    try:
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
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Google token exchange failed"
                )

            google_access_token = token_resp.json().get("access_token")
            if not google_access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an access token"
                )

            userinfo_resp = client.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {google_access_token}"}
            )
            if userinfo_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google profile"
                )
            profile = userinfo_resp.json()
    except httpx.HTTPError as exc:
        logger.error(f"Google OAuth network error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Google to complete sign-in"
        ) from exc

    email = profile.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google profile has no email")

    user = get_or_create_google_user(db, email=email, full_name=profile.get("name", email))
    tokens = _issue_tokens(user)
    record_action(db, "user.login.google", user_id=user.id)
    db.commit()

    # Set auth via httpOnly cookies on the redirect — no tokens in the URL.
    redirect = RedirectResponse(f"{settings.FRONTEND_URL}/app")
    set_auth_cookies(redirect, tokens.access_token, tokens.refresh_token)
    return redirect
