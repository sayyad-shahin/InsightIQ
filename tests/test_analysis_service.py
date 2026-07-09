import pandas as pd

from app.services.analysis_service import analyze


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


def test_ranking_intent_returns_bar_chart():
    res = analyze(_sales_df(), "Which products generated the highest revenue?")
    assert res.result_type == "chart"
    assert res.chart["type"] == "bar"
    assert "revenue" in res.answer.lower()


def test_trend_intent_returns_line_chart():
    res = analyze(_sales_df(), "Show monthly sales trends over time")
    assert res.chart is not None
    assert res.chart["type"] == "line"


def test_anomaly_intent_detects_outliers():
    res = analyze(_sales_df(), "Find anomalies in this dataset")
    # revenue has a 900 spike -> outlier detected, scatter chart
    assert "anomal" in res.answer.lower() or "outlier" in res.answer.lower()


def test_correlation_intent_returns_heatmap():
    res = analyze(_sales_df(), "What is the correlation between metrics?")
    assert res.chart is not None
    assert res.chart["type"] == "heatmap"


def test_forecast_intent_projects_future():
    res = analyze(_sales_df(), "Predict next quarter revenue")
    assert res.chart is not None
    assert res.chart["type"] == "line"
    assert any(s["name"] == "Forecast" for s in res.chart["series"])


def test_summary_is_the_safe_fallback():
    res = analyze(_sales_df(), "hello there")
    assert "insight" in res.answer.lower()
    assert res.result_type in ("text", "chart")


def test_empty_dataframe_is_handled():
    res = analyze(pd.DataFrame(), "summarize")
    assert "empty" in res.answer.lower()
    assert res.chart is None
