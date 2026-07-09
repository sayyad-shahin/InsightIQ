from tests.helpers import signup_and_login


def _make_admin(db_session, email):
    from app.models.user import User, UserRole

    user = db_session.scalar(__import__("sqlalchemy").select(User).where(User.email == email))
    user.role = UserRole.ADMIN
    db_session.add(user)
    db_session.commit()


def test_admin_stats_requires_admin(client):
    headers = signup_and_login(client, email="analyst@example.com")
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403


def test_admin_stats_returns_totals(client, db_session):
    headers = signup_and_login(client, email="boss@example.com")
    _make_admin(db_session, "boss@example.com")
    resp = client.get("/api/v1/admin/stats", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totals"]["users"] >= 1
    assert "ai_configured" in body["services"]
    assert body["services"]["environment"] == "test"
