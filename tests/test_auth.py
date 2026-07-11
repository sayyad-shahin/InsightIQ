def test_signup_creates_user(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "alice@example.com", "full_name": "Alice Analyst", "password": "SuperSecret123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["is_email_verified"] is False
    assert body["role"] == "analyst"


def test_signup_duplicate_email_fails(client):
    payload = {"email": "bob@example.com", "full_name": "Bob", "password": "SuperSecret123"}
    first = client.post("/api/v1/auth/signup", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/auth/signup", json=payload)
    assert second.status_code == 409


def test_login_with_correct_credentials_returns_tokens(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "carol@example.com", "full_name": "Carol", "password": "SuperSecret123"},
    )

    response = client.post(
        "/api/v1/auth/login", json={"email": "carol@example.com", "password": "SuperSecret123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_with_wrong_password_fails(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "dave@example.com", "full_name": "Dave", "password": "SuperSecret123"},
    )

    response = client.post(
        "/api/v1/auth/login", json={"email": "dave@example.com", "password": "WrongPassword"}
    )
    assert response.status_code == 401


def test_get_current_user_requires_token(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_current_user_with_valid_token(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "erin@example.com", "full_name": "Erin", "password": "SuperSecret123"},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": "erin@example.com", "password": "SuperSecret123"}
    )
    access_token = login.json()["access_token"]

    response = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "erin@example.com"


def test_refresh_token_issues_new_access_token(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "frank@example.com", "full_name": "Frank", "password": "SuperSecret123"},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": "frank@example.com", "password": "SuperSecret123"}
    )
    refresh_token = login.json()["refresh_token"]

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_non_admin_cannot_list_users(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "grace@example.com", "full_name": "Grace", "password": "SuperSecret123"},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "SuperSecret123"}
    )
    access_token = login.json()["access_token"]

    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 403


def test_change_password_flow(client):
    client.post("/api/v1/auth/signup", json={"email": "pw@example.com", "full_name": "PW", "password": "SuperSecret123"})
    login = client.post("/api/v1/auth/login", json={"email": "pw@example.com", "password": "SuperSecret123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    wrong = client.post("/api/v1/users/me/password", headers=headers, json={"current_password": "nope", "new_password": "BrandNew123"})
    assert wrong.status_code == 400

    ok = client.post("/api/v1/users/me/password", headers=headers, json={"current_password": "SuperSecret123", "new_password": "BrandNew123"})
    assert ok.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": "pw@example.com", "password": "BrandNew123"}).status_code == 200


def test_cookie_auth_and_csrf(client):
    client.post("/api/v1/auth/signup", json={"email": "cookie@example.com", "full_name": "C", "password": "SuperSecret123"})
    login = client.post("/api/v1/auth/login", json={"email": "cookie@example.com", "password": "SuperSecret123"})
    assert login.status_code == 200
    assert client.cookies.get("iq_access")  # httpOnly access cookie set
    csrf = client.cookies.get("iq_csrf")
    assert csrf

    # Cookie-authenticated GET works without an Authorization header.
    me = client.get("/api/v1/users/me")
    assert me.status_code == 200
    assert me.json()["email"] == "cookie@example.com"

    # Cookie-auth state-changing request without a CSRF header is rejected.
    assert client.post("/api/v1/chats", json={"title": "x"}).status_code == 403
    # With the matching CSRF header it succeeds.
    ok = client.post("/api/v1/chats", json={"title": "x"}, headers={"X-CSRF-Token": csrf})
    assert ok.status_code == 201


def test_logout_clears_cookies(client):
    client.post("/api/v1/auth/signup", json={"email": "lo@example.com", "full_name": "L", "password": "SuperSecret123"})
    client.post("/api/v1/auth/login", json={"email": "lo@example.com", "password": "SuperSecret123"})
    csrf = client.cookies.get("iq_csrf")
    out = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert out.status_code == 204
    # cookie cleared -> subsequent cookie-only request is unauthorized
    client.cookies.clear()
    assert client.get("/api/v1/users/me").status_code == 401


def test_refresh_via_cookie(client):
    client.post("/api/v1/auth/signup", json={"email": "rf@example.com", "full_name": "R", "password": "SuperSecret123"})
    client.post("/api/v1/auth/login", json={"email": "rf@example.com", "password": "SuperSecret123"})
    csrf = client.cookies.get("iq_csrf")
    # No body — refresh token comes from the cookie.
    r = client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_auth_cookie_attributes_match_settings(client):
    from app.core.config import settings

    client.post("/api/v1/auth/signup", json={"email": "ck@example.com", "full_name": "K", "password": "SuperSecret123"})
    login = client.post("/api/v1/auth/login", json={"email": "ck@example.com", "password": "SuperSecret123"})
    assert login.status_code == 200

    set_cookies = login.headers.get_list("set-cookie")
    by_name = {c.split("=", 1)[0]: c for c in set_cookies}
    assert {"iq_access", "iq_refresh", "iq_csrf"} <= set(by_name)

    samesite = settings.COOKIE_SAMESITE.lower()
    path = settings.COOKIE_PATH
    for name in ("iq_access", "iq_refresh"):
        header = by_name[name].lower()
        # Session tokens are httpOnly and carry the configured SameSite/Path.
        assert "httponly" in header
        assert f"samesite={samesite}" in header
        assert f"path={path.lower()}" in header

    # The CSRF token must be readable by JS (double-submit), so never httpOnly.
    assert "httponly" not in by_name["iq_csrf"].lower()
