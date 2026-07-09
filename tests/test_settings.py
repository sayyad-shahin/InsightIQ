from tests.helpers import signup_and_login


def test_settings_created_on_first_read(client):
    headers = signup_and_login(client)
    resp = client.get("/api/v1/settings/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["theme"] == "system"
    assert body["language"] == "en"


def test_settings_update(client):
    headers = signup_and_login(client)
    resp = client.patch(
        "/api/v1/settings/me",
        headers=headers,
        json={"theme": "dark", "language": "fr", "preferences": {"density": "compact"}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["theme"] == "dark"
    assert body["language"] == "fr"
    assert body["preferences"]["density"] == "compact"
    # secrets are never returned; only a "set" flag map is exposed
    assert "api_keys_set" in body["preferences"]


def test_settings_requires_auth(client):
    assert client.get("/api/v1/settings/me").status_code == 401
