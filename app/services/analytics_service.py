"""
Analytics bundle builder.

Computes an executive analytics package over the *full* DataFrame — KPIs, trend,
category & geographic breakdowns, value segmentation, correlation, distributions,
missing-value analysis, anomaly detection with severity, and derived business
insights (drivers, risks, opportunities, recommendations). Everything is real,
computed from the data. Chart specs match the frontend ChartSpec contract.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.analysis_service import (
    _categorical_cols,
    _datetime_cols,
    _fmt,
    _numeric_cols,
    _pick_category,
    _pick_datetime,
    _pick_measure,
    _prepare,
)
from app.services.dataset_service import build_quality_report, compute_statistics, quality_score

GEO_HINTS = ["region", "country", "state", "city", "province", "location", "territory", "zone", "market"]


def _severity(ratio: float) -> str:
    return "high" if ratio > 0.1 else "medium" if ratio > 0.03 else "low"


def build_analytics(df: pd.DataFrame, measure: str | None = None, dimension: str | None = None) -> dict[str, Any]:
    prepared = _prepare(df)
    numeric = _numeric_cols(prepared)
    cats = _categorical_cols(prepared)
    dates = _datetime_cols(prepared)

    primary = measure if measure in numeric else _pick_measure(prepared, "")
    dim = dimension if dimension in cats else _pick_category(prepared, "")
    date_col = _pick_datetime(prepared, "")

    stats = compute_statistics(prepared)
    quality = build_quality_report(prepared)

    return {
        "primary_measure": primary,
        "dimension": dim,
        "date_column": date_col,
        "options": {"measures": numeric, "dimensions": cats, "date_columns": dates},
        "kpis": _kpis(prepared, numeric, primary),
        "trend": _trend(prepared, date_col, primary),
        "category_breakdown": _breakdown(prepared, dim, primary),
        "segmentation": _segmentation(prepared, primary),
        "geographic": _geographic(prepared, numeric, cats, primary),
        "correlation": _correlation(prepared, numeric, stats),
        "distributions": stats["distributions"],
        "missing_values": {
            "columns": [
                {"name": k, "missing_count": v["missing_count"], "missing_pct": v["missing_pct"]}
                for k, v in quality["missing_values"].items()
            ],
            "duplicate_rows": quality["duplicate_rows"],
        },
        "anomalies": _anomalies(prepared, numeric),
        "insights": _insights(prepared, numeric, cats, primary, dim, date_col, stats, quality),
    }


def _kpis(df: pd.DataFrame, numeric: list[str], primary: str | None) -> dict[str, Any]:
    rows, cols = len(df), len(df.columns)
    completeness = round(100 - float(df.isna().sum().sum()) / (rows * max(cols, 1)) * 100, 1) if rows else 0.0
    ranked = sorted(numeric, key=lambda c: float(df[c].var(skipna=True) or 0), reverse=True)[:4]
    measures = []
    for c in ranked:
        s = df[c].dropna()
        if s.empty:
            continue
        measures.append(
            {
                "name": c,
                "total": round(float(s.sum()), 2),
                "mean": round(float(s.mean()), 2),
                "min": round(float(s.min()), 2),
                "max": round(float(s.max()), 2),
                "is_primary": c == primary,
            }
        )
    return {
        "row_count": rows,
        "column_count": cols,
        "quality_score": quality_score(df),
        "completeness": completeness,
        "numeric_count": len(numeric),
        "measures": measures,
    }


def _trend(df: pd.DataFrame, date_col: str | None, primary: str | None) -> dict[str, Any] | None:
    if not date_col or not primary:
        return None
    s = df[[date_col, primary]].dropna().set_index(date_col).sort_index()[primary].resample("ME").sum()
    s = s[s.index.notna()]
    if len(s) < 2:
        return None
    first, last = float(s.iloc[0]), float(s.iloc[-1])
    change = (last - first) / abs(first) * 100 if first else 0.0
    return {
        "change_pct": round(change, 1),
        "direction": "up" if change > 1 else "down" if change < -1 else "flat",
        "peak": {"date": s.idxmax().date().isoformat(), "value": round(float(s.max()), 2)},
        "chart": {
            "type": "area",
            "title": f"{primary} over time",
            "x": [d.date().isoformat() for d in s.index],
            "series": [{"name": primary, "values": [round(float(v), 2) for v in s.values]}],
            "x_title": "Date",
            "y_title": primary,
        },
    }


def _breakdown(df: pd.DataFrame, dim: str | None, primary: str | None) -> dict[str, Any] | None:
    if not dim:
        return None
    if primary:
        grouped = df.groupby(dim, dropna=True)[primary].sum().sort_values(ascending=False).head(10)
        label = primary
    else:
        grouped = df[dim].value_counts().head(10)
        label = "count"
    if grouped.empty:
        return None
    total = float(grouped.sum()) or 1.0
    rows = [{"name": str(i), "value": round(float(v), 2), "pct": round(float(v) / total * 100, 1)} for i, v in grouped.items()]
    return {
        "dimension": dim,
        "measure": label,
        "rows": rows,
        "bar": {
            "type": "bar",
            "title": f"{label} by {dim}",
            "x": [str(i) for i in grouped.index],
            "series": [{"name": label, "values": [round(float(v), 2) for v in grouped.values]}],
            "x_title": dim,
            "y_title": label,
        },
        "pie": {
            "type": "pie",
            "title": f"{label} share by {dim}",
            "x": [str(i) for i in grouped.head(6).index],
            "series": [{"name": label, "values": [round(float(v), 2) for v in grouped.head(6).values]}],
        },
    }


def _segmentation(df: pd.DataFrame, primary: str | None) -> dict[str, Any] | None:
    if not primary:
        return None
    s = df[primary].dropna()
    if s.empty or s.nunique() < 4:
        return None
    labels = ["Low", "Medium", "High", "Top"]
    try:
        binned = pd.qcut(s, 4, labels=labels, duplicates="drop")
    except ValueError:
        return None
    counts = binned.value_counts().reindex([lbl for lbl in labels if lbl in binned.cat.categories]).dropna()
    return {
        "measure": primary,
        "chart": {
            "type": "bar",
            "title": f"Segments by {primary}",
            "x": [str(i) for i in counts.index],
            "series": [{"name": "Records", "values": [int(v) for v in counts.values]}],
            "x_title": "Segment",
            "y_title": "Records",
        },
    }


def _geographic(df: pd.DataFrame, numeric: list[str], cats: list[str], primary: str | None) -> dict[str, Any] | None:
    geo_col = next((c for c in cats if any(h in c.lower() for h in GEO_HINTS)), None)
    if not geo_col:
        return None
    if primary:
        grouped = df.groupby(geo_col, dropna=True)[primary].sum().sort_values(ascending=False).head(12)
        label = primary
    else:
        grouped = df[geo_col].value_counts().head(12)
        label = "count"
    if grouped.empty:
        return None
    return {
        "column": geo_col,
        "chart": {
            "type": "bar",
            "title": f"{label} by {geo_col}",
            "x": [str(i) for i in grouped.index],
            "series": [{"name": label, "values": [round(float(v), 2) for v in grouped.values]}],
            "x_title": geo_col,
            "y_title": label,
        },
    }


def _correlation(df: pd.DataFrame, numeric: list[str], stats: dict[str, Any]) -> dict[str, Any] | None:
    if not stats.get("correlation"):
        return None
    corr = df[numeric].corr(numeric_only=True)
    pairs = []
    for i, a in enumerate(numeric):
        for b in numeric[i + 1 :]:
            v = corr.loc[a, b]
            if pd.notna(v):
                pairs.append({"a": a, "b": b, "value": round(float(v), 3)})
    pairs.sort(key=lambda p: abs(p["value"]), reverse=True)
    return {
        "chart": {"type": "heatmap", "title": "Correlation matrix", **stats["correlation"]},
        "top_pairs": pairs[:5],
    }


def _anomalies(df: pd.DataFrame, numeric: list[str]) -> dict[str, Any]:
    rows = len(df)
    items = []
    worst = None
    for col in numeric:
        s = df[col].dropna()
        if s.empty:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        mask = (s < low) | (s > high)
        count = int(mask.sum())
        if not count:
            continue
        ratio = count / rows if rows else 0
        items.append(
            {
                "column": col,
                "count": count,
                "pct": round(ratio * 100, 1),
                "severity": _severity(ratio),
                "lower_bound": round(float(low), 2),
                "upper_bound": round(float(high), 2),
                "extremes": [round(float(v), 2) for v in s[mask].abs().nlargest(3).tolist()],
                "root_cause": f"{count} value(s) fall outside the expected range [{_fmt(low)}, {_fmt(high)}].",
            }
        )
        if worst is None or count > worst[1]:
            worst = (col, count)

    items.sort(key=lambda x: x["count"], reverse=True)

    chart = None
    if worst:
        col = worst[0]
        s = df[col].dropna().reset_index(drop=True)
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        out = (s < low) | (s > high)
        chart = {
            "type": "scatter",
            "title": f"Outliers in {col}",
            "x": [int(i) for i in s.index],
            "series": [
                {"name": "Normal", "values": [round(float(v), 2) if not o else None for v, o in zip(s, out)]},
                {"name": "Outlier", "values": [round(float(v), 2) if o else None for v, o in zip(s, out)]},
            ],
            "x_title": "Row",
            "y_title": col,
        }

    recommendations = []
    for it in items[:3]:
        if it["severity"] == "high":
            recommendations.append(f"Investigate **{it['column']}** — {it['pct']}% of values are outliers; check for data-entry or process issues.")
        else:
            recommendations.append(f"Review **{it['column']}** outliers before aggregating; consider capping or excluding extreme values.")
    if not items:
        recommendations.append("No statistical anomalies detected — the numeric data is consistent.")

    return {"items": items, "chart": chart, "recommendations": recommendations}


def _insights(
    df: pd.DataFrame,
    numeric: list[str],
    cats: list[str],
    primary: str | None,
    dim: str | None,
    date_col: str | None,
    stats: dict[str, Any],
    quality: dict[str, Any],
) -> dict[str, list[str]]:
    key_insights: list[str] = [f"{len(df):,} records across {len(df.columns)} columns."]
    opportunities: list[str] = []
    risks: list[str] = []
    drivers: list[str] = []
    growth: list[str] = []
    recommendations: list[str] = []

    if primary:
        s = df[primary].dropna()
        if not s.empty:
            key_insights.append(f"Total {primary} is {_fmt(float(s.sum()))} (avg {_fmt(float(s.mean()))}).")

    if dim and primary:
        grouped = df.groupby(dim, dropna=True)[primary].sum().sort_values(ascending=False)
        if not grouped.empty:
            total = float(grouped.sum()) or 1.0
            top_share = float(grouped.iloc[0]) / total * 100
            key_insights.append(f"**{grouped.index[0]}** leads {dim} with {top_share:.0f}% of {primary}.")
            if top_share > 50:
                risks.append(f"Revenue is concentrated: **{grouped.index[0]}** alone drives {top_share:.0f}% of {primary} — a single-point dependency.")
            if len(grouped) > 2:
                laggard = grouped.index[-1]
                opportunities.append(f"**{laggard}** underperforms in {primary} — targeted growth here could lift the total.")

    # Revenue drivers: strongest correlation with the primary measure.
    if primary and stats.get("correlation"):
        corr = df[numeric].corr(numeric_only=True)
        if primary in corr.columns:
            others = corr[primary].drop(labels=[primary]).dropna()
            if not others.empty:
                driver = others.abs().idxmax()
                r = float(others[driver])
                if abs(r) > 0.3:
                    drivers.append(f"**{driver}** {'moves with' if r > 0 else 'moves against'} {primary} (r={r:+.2f}) — a key lever.")

    # Growth trend from time series.
    if date_col and primary:
        s = df[[date_col, primary]].dropna().set_index(date_col).sort_index()[primary].resample("ME").sum()
        s = s[s.index.notna()]
        if len(s) >= 2 and float(s.iloc[0]):
            change = (float(s.iloc[-1]) - float(s.iloc[0])) / abs(float(s.iloc[0])) * 100
            growth.append(f"{primary} has {'grown' if change > 0 else 'declined'} {change:+.0f}% over the observed period.")
            if change < 0:
                risks.append(f"{primary} is trending down ({change:+.0f}%) — investigate the drivers.")
            else:
                opportunities.append(f"Positive momentum in {primary} (+{change:.0f}%) — consider scaling what's working.")

    # Data-quality risks.
    total_cells = len(df) * max(len(df.columns), 1)
    missing_pct = float(df.isna().sum().sum()) / total_cells * 100 if total_cells else 0
    if missing_pct > 5:
        risks.append(f"{missing_pct:.0f}% of cells are missing — clean the data before high-stakes decisions.")
        recommendations.append("Run smart cleaning to impute or drop missing values.")
    if quality["duplicate_rows"]:
        risks.append(f"{quality['duplicate_rows']} duplicate row(s) may inflate aggregates.")

    if drivers:
        recommendations.append(f"Double down on {drivers[0].split('**')[1]} to influence {primary}.")
    if not recommendations:
        recommendations.append("Data looks healthy — proceed to forecasting and scenario analysis.")
    if not opportunities:
        opportunities.append("Explore correlations and segments to surface untapped growth areas.")
    if not risks:
        risks.append("No major risks detected in the current data.")
    if not drivers:
        drivers.append("Add more numeric metrics to reveal statistical revenue drivers.")
    if not growth:
        growth.append("Attach a date column to unlock trend and growth analysis.")

    return {
        "key_insights": key_insights,
        "opportunities": opportunities,
        "risks": risks,
        "revenue_drivers": drivers,
        "growth_trends": growth,
        "recommendations": recommendations,
    }
