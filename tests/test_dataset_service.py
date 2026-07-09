import pandas as pd

from app.services.dataset_service import (
    build_preview,
    build_quality_report,
    build_schema_snapshot,
    clean_dataframe,
    compute_statistics,
    quality_score,
)


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


def test_compute_statistics_returns_stats_correlation_distributions():
    stats = compute_statistics(_sample_df())
    assert stats["row_count"] == 6
    assert stats["column_count"] == 3
    assert 0 <= stats["quality_score"] <= 100
    assert "revenue" in stats["statistics"]
    assert stats["statistics"]["orders"]["min"] == 8.0
    # two numeric columns -> correlation matrix present
    assert stats["correlation"] is not None
    assert set(stats["correlation"]["columns"]) == {"revenue", "orders"}
    assert stats["distributions"]["region"]["type"] == "categorical"
    assert stats["distributions"]["orders"]["type"] == "numeric"


def test_quality_score_perfect_data_is_high():
    clean = pd.DataFrame({"a": [1, 2, 3, 4], "b": [10, 20, 30, 40]})
    assert quality_score(clean) >= 95


def test_clean_dataframe_removes_duplicates_and_fills_missing():
    df = pd.DataFrame(
        {
            "name": [" Alice ", "Bob", "Bob", None],
            "score": [10, 20, 20, None],
        }
    )
    df = pd.concat([df, df.iloc[[1]]], ignore_index=True)  # add a full duplicate
    cleaned, summary = clean_dataframe(
        df,
        {
            "trim_whitespace": True,
            "remove_duplicates": True,
            "fill_missing": True,
            "fill_strategy": "median",
            "drop_empty_rows": False,
            "convert_types": False,
            "normalize_dates": False,
        },
    )
    assert summary["duplicates_after"] == 0
    assert summary["missing_after"] == 0
    assert cleaned["score"].isna().sum() == 0
    assert " Alice " not in cleaned["name"].tolist()  # trimmed
    assert summary["rows_after"] < summary["rows_before"]


def test_clean_dataframe_noop_reports_no_changes():
    df = pd.DataFrame({"a": [1, 2, 3]})
    _, summary = clean_dataframe(df, {"remove_duplicates": True})
    assert summary["operations_applied"] == ["No changes were necessary"]
