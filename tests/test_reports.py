from tests.helpers import signup_and_login, upload_csv

CSV = "region,revenue\nNorth,100\nSouth,150\nEast,200\n"


def test_create_and_fetch_report(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)

    resp = client.post(
        "/api/v1/reports",
        headers=headers,
        json={"dataset_id": dataset["id"], "title": "Q3 Summary"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "Q3 Summary"
    assert body["sections"]["overview"]["row_count"] == 3

    report_id = body["id"]
    assert client.get(f"/api/v1/reports/{report_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/reports", headers=headers).json()[0]["id"] == report_id
    assert client.delete(f"/api/v1/reports/{report_id}", headers=headers).status_code == 204


def test_report_requires_owned_dataset(client):
    headers = signup_and_login(client)
    resp = client.post(
        "/api/v1/reports",
        headers=headers,
        json={"dataset_id": "00000000-0000-0000-0000-000000000000", "title": "X"},
    )
    assert resp.status_code == 404
