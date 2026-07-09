from tests.helpers import signup_and_login, upload_csv

# Monotonic numeric series so the regression has a clear trend.
CSV = "month,sales\n1,100\n2,150\n3,200\n4,250\n5,300\n6,350\n"


def test_forecast_runs_eagerly_and_returns_result(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)

    resp = client.post(
        "/api/v1/forecasts",
        headers=headers,
        json={"dataset_id": dataset["id"], "target_column": "sales", "horizon_periods": 3},
    )
    assert resp.status_code == 201, resp.text
    forecast_id = resp.json()["id"]

    detail = client.get(f"/api/v1/forecasts/{forecast_id}", headers=headers).json()
    assert detail["status"] == "done"
    assert len(detail["result"]["forecast"]) == 3
    # Upward trend should continue beyond the last observed value (350).
    assert detail["result"]["forecast"][0] > 350


def test_forecast_unknown_column_fails_gracefully(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    resp = client.post(
        "/api/v1/forecasts",
        headers=headers,
        json={"dataset_id": dataset["id"], "target_column": "does_not_exist"},
    )
    assert resp.status_code == 201
    detail = client.get(f"/api/v1/forecasts/{resp.json()['id']}", headers=headers).json()
    assert detail["status"] == "failed"
    assert "not found" in detail["error_message"].lower()


def test_list_forecasts_filtered_by_dataset(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    client.post(
        "/api/v1/forecasts",
        headers=headers,
        json={"dataset_id": dataset["id"], "target_column": "sales"},
    )
    listing = client.get(f"/api/v1/forecasts?dataset_id={dataset['id']}", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1


def test_forecast_result_includes_confidence_and_metrics(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)
    resp = client.post(
        "/api/v1/forecasts",
        headers=headers,
        json={"dataset_id": dataset["id"], "target_column": "sales", "horizon_periods": 4},
    )
    forecast_id = resp.json()["id"]
    detail = client.get(f"/api/v1/forecasts/{forecast_id}", headers=headers).json()
    result = detail["result"]
    assert len(result["lower"]) == 4 and len(result["upper"]) == 4
    assert all(lo <= f <= up for lo, f, up in zip(result["lower"], result["forecast"], result["upper"]))
    assert "r2" in result["metrics"] and "mae" in result["metrics"]
