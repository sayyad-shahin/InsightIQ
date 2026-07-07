import pandas as pd

from app.services.dataset_service import build_preview, build_quality_report, build_schema_snapshot


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "region": ["North", "South", "North", "East", "South", "North"],
            "revenue": [1000, 1500, None, 2000, 1500, 100000],
            "orders": [10, 15, 12, 20, 15, 8],
        }
    )


def test_build_schema_snapshot_lists_all_columns():
    snapshot = build_schema_snapshot(_sample_df())
    column_names = [col["name"] for col in snapshot["columns"]]
    assert column_names == ["region", "revenue", "orders"]


def test_build_quality_report_detects_missing_values():
    report = build_quality_report(_sample_df())
    assert "revenue" in report["missing_values"]
    assert report["missing_values"]["revenue"]["missing_count"] == 1


def test_build_quality_report_detects_duplicate_rows():
    df = _sample_df()
    df_with_dupe = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    report = build_quality_report(df_with_dupe)
    assert report["duplicate_rows"] >= 1


def test_build_quality_report_detects_outliers():
    report = build_quality_report(_sample_df())
    assert "revenue" in report["outliers"]


def test_build_preview_limits_rows_and_serializes_nan_as_none():
    preview = build_preview(_sample_df(), limit=3)
    assert preview["previewed_rows"] == 3
    assert preview["total_rows"] == 6
    assert preview["columns"] == ["region", "revenue", "orders"]
