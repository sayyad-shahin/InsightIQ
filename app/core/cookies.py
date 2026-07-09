"""Auth cookie helpers: httpOnly access/refresh + a readable CSRF token."""

from __future__ import annotations

import secrets

from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "iq_access"
REFRESH_COOKIE = "iq_refresh"
CSRF_COOKIE = "iq_csrf"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> str:
    """Set httpOnly access/refresh cookies + a JS-readable CSRF token (double-submit)."""
    secure = settings.is_production
    access_max = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    refresh_max = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400
    csrf = secrets.token_urlsafe(32)

    response.set_cookie(
        ACCESS_COOKIE, access_token, max_age=access_max, httponly=True, secure=secure, samesite="lax", path="/"
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh_token, max_age=refresh_max, httponly=True, secure=secure, samesite="lax", path="/"
    )
    # CSRF cookie is readable by JS (double-submit); outlives the access token so
    # it's still available when the client silently refreshes.
    response.set_cookie(
        CSRF_COOKIE, csrf, max_age=refresh_max, httponly=False, secure=secure, samesite="lax", path="/"
    )
    return csrf


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, path="/")
