"""
Durable-storage regression: on hosts with EPHEMERAL disks (e.g. Render free tier)
the uploaded file and on-disk parquet artifacts are wiped on every restart/redeploy.
The dataset's parsed copy is also persisted in the DB, so analysis must still work
after the disk is gone.
"""
import shutil
from pathlib import Path

from app.core.config import settings
from tests.helpers import signup_and_login, upload_csv

CSV = "month,region,revenue\n2024-01,North,1200\n2024-02,North,1500\n2024-03,South,1800\n"


def test_analytics_survives_disk_wipe_via_db_artifact(client):
    headers = signup_and_login(client)
    dataset = upload_csv(client, headers, CSV)  # processed eagerly -> parsed_artifact stored in DB
    dataset_id = dataset["id"]

    # Sanity: analytics works normally first.
    assert client.get(f"/api/v1/datasets/{dataset_id}/analytics", headers=headers).status_code == 200

    # Simulate an ephemeral-disk restart: delete every uploaded file + on-disk artifact.
    upload_dir = Path(settings.UPLOAD_DIR)
    if upload_dir.exists():
        shutil.rmtree(upload_dir)

    # Analytics must STILL succeed, loading the parquet copy from the database.
    r = client.get(f"/api/v1/datasets/{dataset_id}/analytics", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["primary_measure"] == "revenue"

    # Statistics (also uses load_analysis_dataframe) must work too.
    assert client.get(f"/api/v1/datasets/{dataset_id}/statistics", headers=headers).status_code == 200
