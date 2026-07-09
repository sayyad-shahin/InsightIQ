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


SALES_CSV = (
    "region,product,revenue,orders\n"
    "North,Widget,100,10\nSouth,Gadget,200,20\nEast,Gizmo,150,15\n"
    "West,Widget,400,40\nNorth,Gadget,900,90\nSouth,Gizmo,130,13\n"
)


def _upload_ready_dataset(client, headers):
    from tests.helpers import upload_csv

    return upload_csv(client, headers, SALES_CSV, filename="sales.csv")


def test_chat_message_on_dataset_returns_chart(client):
    headers = signup_and_login(client)
    dataset = _upload_ready_dataset(client, headers)
    chat = client.post("/api/v1/chats", headers=headers, json={"title": "New conversation", "dataset_id": dataset["id"]}).json()

    resp = client.post(
        f"/api/v1/chats/{chat['id']}/messages",
        headers=headers,
        json={"content": "Which products generated the highest revenue?"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["result_type"] == "chart"
    assert body["result_payload"]["type"] == "bar"


def test_chat_auto_titles_from_first_message(client):
    headers = signup_and_login(client)
    dataset = _upload_ready_dataset(client, headers)
    chat = client.post("/api/v1/chats", headers=headers, json={"title": "New conversation", "dataset_id": dataset["id"]}).json()
    client.post(f"/api/v1/chats/{chat['id']}/messages", headers=headers, json={"content": "Summarize key insights"})

    refreshed = client.get(f"/api/v1/chats/{chat['id']}", headers=headers).json()
    assert refreshed["title"].startswith("Summarize key insights")


def test_rename_conversation(client):
    headers = signup_and_login(client)
    chat = client.post("/api/v1/chats", headers=headers, json={"title": "x"}).json()
    resp = client.patch(f"/api/v1/chats/{chat['id']}", headers=headers, json={"title": "Q3 review"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Q3 review"


def test_stream_message_emits_sse_events(client):
    headers = signup_and_login(client)
    dataset = _upload_ready_dataset(client, headers)
    chat = client.post("/api/v1/chats", headers=headers, json={"title": "New conversation", "dataset_id": dataset["id"]}).json()

    resp = client.post(
        f"/api/v1/chats/{chat['id']}/messages/stream",
        headers=headers,
        json={"content": "Show revenue by region"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    assert '"type": "token"' in resp.text
    assert '"type": "done"' in resp.text
    # the persisted message id is carried in the done event
    assert '"result_type"' in resp.text
