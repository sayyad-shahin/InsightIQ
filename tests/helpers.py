"""Shared test helpers for authenticating and seeding data via the API."""

from fastapi.testclient import TestClient


def signup_and_login(client: TestClient, email: str = "user@example.com", password: str = "SuperSecret123") -> dict:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "full_name": "Test User", "password": password},
    )
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def upload_csv(client: TestClient, headers: dict, content: str, filename: str = "data.csv") -> dict:
    resp = client.post(
        "/api/v1/datasets/upload",
        headers=headers,
        files={"file": (filename, content, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
