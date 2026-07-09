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


DIRTY_CSV = "name,score\n Alice ,10\nBob,20\nBob,20\n,\n"


def test_statistics_endpoint(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    resp = client.get(f"/api/v1/datasets/{dataset['id']}/statistics", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["row_count"] == 3
    assert "revenue" in body["statistics"]
    assert 0 <= body["quality_score"] <= 100


def test_rename_and_duplicate(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)

    renamed = client.patch(f"/api/v1/datasets/{dataset['id']}", headers=headers, json={"name": "Q3 sales"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Q3 sales"

    dup = client.post(f"/api/v1/datasets/{dataset['id']}/duplicate", headers=headers)
    assert dup.status_code == 201
    assert dup.json()["name"] == "Q3 sales (copy)"
    assert len(client.get("/api/v1/datasets", headers=headers).json()) == 2


def test_download_dataset(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    resp = client.get(f"/api/v1/datasets/{dataset['id']}/download", headers=headers)
    assert resp.status_code == 200
    assert "revenue" in resp.text


def test_clean_preview_apply_and_undo(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, DIRTY_CSV, filename="dirty.csv")
    ops = {"remove_duplicates": True, "fill_missing": True, "drop_empty_rows": True, "trim_whitespace": True}

    preview = client.post(f"/api/v1/datasets/{dataset['id']}/clean/preview", headers=headers, json=ops)
    assert preview.status_code == 200, preview.text
    assert preview.json()["summary"]["duplicates_after"] == 0

    applied = client.post(f"/api/v1/datasets/{dataset['id']}/clean/apply", headers=headers, json=ops)
    assert applied.status_code == 200, applied.text
    assert applied.json()["quality_report"]["duplicate_rows"] == 0

    undone = client.post(f"/api/v1/datasets/{dataset['id']}/clean/undo", headers=headers)
    assert undone.status_code == 200, undone.text
    # original had a duplicate Bob row again
    assert undone.json()["quality_report"]["duplicate_rows"] >= 1

    # undoing again should 409 (nothing to undo)
    assert client.post(f"/api/v1/datasets/{dataset['id']}/clean/undo", headers=headers).status_code == 409
