from tests.helpers import signup_and_login


def test_chat_lifecycle_with_graceful_ai_fallback(client):
    headers = signup_and_login(client)

    created = client.post("/api/v1/chats", headers=headers, json={"title": "Sales Q&A"})
    assert created.status_code == 201, created.text
    chat_id = created.json()["id"]

    # No GOOGLE_API_KEY in tests -> assistant replies with a graceful fallback,
    # and the endpoint must still return 201 (never 500).
    msg = client.post(
        f"/api/v1/chats/{chat_id}/messages",
        headers=headers,
        json={"content": "What is the total revenue?"},
    )
    assert msg.status_code == 201, msg.text
    assert msg.json()["role"] == "assistant"

    detail = client.get(f"/api/v1/chats/{chat_id}", headers=headers).json()
    assert len(detail["messages"]) == 2  # user + assistant
    assert detail["messages"][0]["role"] == "user"


def test_chat_not_found_for_other_user(client):
    owner = signup_and_login(client, email="owner@example.com")
    chat_id = client.post("/api/v1/chats", headers=owner, json={"title": "x"}).json()["id"]
    other = signup_and_login(client, email="other@example.com")
    assert client.get(f"/api/v1/chats/{chat_id}", headers=other).status_code == 404


def test_start_chat_with_unknown_dataset_404(client):
    headers = signup_and_login(client)
    resp = client.post(
        "/api/v1/chats",
        headers=headers,
        json={"title": "x", "dataset_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404
