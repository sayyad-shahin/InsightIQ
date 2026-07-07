from tests.helpers import signup_and_login, upload_csv

CSV = "region,revenue\nNorth,100\nSouth,150\nEast,200\n"


def test_upload_processes_dataset_eagerly(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    # Eager Celery processing runs inline during the request lifecycle.
    detail = client.get(f"/api/v1/datasets/{dataset['id']}", headers=headers).json()
    assert detail["status"] == "cleaned"
    assert detail["row_count"] == 3
    assert detail["column_count"] == 2


def test_upload_rejects_unsupported_type(client):
    headers = signup_and_login(client)
    resp = client.post(
        "/api/v1/datasets/upload",
        headers=headers,
        files={"file": ("notes.txt", "hello", "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_rejects_empty_file(client):
    headers = signup_and_login(client)
    resp = client.post(
        "/api/v1/datasets/upload",
        headers=headers,
        files={"file": ("empty.csv", "", "text/csv")},
    )
    assert resp.status_code == 400


def test_preview_and_quality_report(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    preview = client.get(f"/api/v1/datasets/{dataset['id']}/preview", headers=headers)
    assert preview.status_code == 200
    assert preview.json()["columns"] == ["region", "revenue"]

    quality = client.get(f"/api/v1/datasets/{dataset['id']}/quality-report", headers=headers)
    assert quality.status_code == 200
    assert "suggestions" in quality.json()


def test_cannot_access_another_users_dataset(client):
    owner = signup_and_login(client, email="owner@example.com")
    dataset = upload_csv(client, owner, CSV)
    other = signup_and_login(client, email="other@example.com")
    assert client.get(f"/api/v1/datasets/{dataset['id']}", headers=other).status_code == 404
