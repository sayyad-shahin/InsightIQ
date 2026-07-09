import pandas as pd

from app.services.analytics_service import build_analytics


def _sales_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": pd.date_range("2024-01-01", periods=12, freq="ME").astype(str),
            "region": ["North", "South", "East", "West"] * 3,
            "product": ["Widget", "Gadget", "Gizmo", "Widget"] * 3,
            "revenue": [100, 200, 150, 400, 120, 220, 900, 420, 130, 240, 180, 460],
            "orders": [10, 20, 15, 40, 12, 22, 90, 42, 13, 24, 18, 46],
        }
    )


def test_build_analytics_full_bundle():
    a = build_analytics(_sales_df())
    assert a["primary_measure"] in ("revenue", "orders")
    assert a["kpis"]["row_count"] == 12
    assert 0 <= a["kpis"]["quality_score"] <= 100
    assert len(a["kpis"]["measures"]) >= 1

    assert a["trend"] is not None and a["trend"]["chart"]["type"] == "area"
    assert a["category_breakdown"]["bar"]["type"] == "bar"
    assert a["geographic"] is not None and a["geographic"]["column"] == "region"
    assert a["correlation"]["chart"]["type"] == "heatmap"
    assert a["anomalies"]["items"]  # revenue spike is an outlier
    assert a["insights"]["key_insights"]


def test_analytics_respects_measure_and_dimension_overrides():
    a = build_analytics(_sales_df(), measure="orders", dimension="product")
    assert a["primary_measure"] == "orders"
    assert a["category_breakdown"]["dimension"] == "product"


def test_analytics_handles_measureless_data():
    df = pd.DataFrame({"note": ["a", "b", "c", "d"]})
    a = build_analytics(df)
    assert a["kpis"]["row_count"] == 4
    assert a["trend"] is None
    assert a["insights"]["growth_trends"]
