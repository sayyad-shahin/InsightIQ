from tests.helpers import signup_and_login, upload_csv

CSV = "region,revenue\nNorth,100\nSouth,150\nEast,200\n"


def test_health_live_and_ready(client):
    assert client.get("/health/live").json()["status"] == "alive"
    ready = client.get("/health/ready")
    body = ready.json()
    assert body["checks"]["database"] is True  # sqlite reachable in tests
    assert "redis" in body["checks"]
    assert ready.status_code in (200, 503)


def test_user_stats_counts(client):
    headers = signup_and_login(client)
    upload_csv(client, headers, CSV)
    client.post("/api/v1/chats", headers=headers, json={"title": "c"})
    stats = client.get("/api/v1/users/me/stats", headers=headers).json()
    assert stats["datasets"] == 1
    assert stats["chats"] == 1
    assert stats["forecasts"] == 0
    assert stats["reports"] == 0


def test_pagination_limit_offset(client):
    headers = signup_and_login(client)
    for _ in range(3):
        upload_csv(client, headers, CSV)
    assert len(client.get("/api/v1/datasets", headers=headers).json()) == 3  # no params = all (compat)
    assert len(client.get("/api/v1/datasets?limit=2", headers=headers).json()) == 2
    assert len(client.get("/api/v1/datasets?limit=2&offset=2", headers=headers).json()) == 1


def test_api_keys_encrypted_not_returned(client, db_session):
    from app.models.setting import UserSetting
    from app.core.crypto import decrypt_secret
    import sqlalchemy as sa

    headers = signup_and_login(client, email="keys@example.com")
    client.patch("/api/v1/settings/me", headers=headers, json={"preferences": {"api_keys": {"gemini": "SECRET123"}}})

    got = client.get("/api/v1/settings/me", headers=headers).json()
    # plaintext never returned; only a set flag
    assert "api_keys" not in got["preferences"]
    assert got["preferences"]["api_keys_set"]["gemini"] is True

    # stored value is encrypted, not plaintext
    stored = db_session.scalar(sa.select(UserSetting).where(UserSetting.user_id != None)).preferences  # noqa: E711
    enc = stored["api_keys"]["gemini"]
    assert enc != "SECRET123"
    assert decrypt_secret(enc) == "SECRET123"
