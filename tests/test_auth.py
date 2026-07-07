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
