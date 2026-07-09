"""
Grounded dataset analysis engine.

Turns a natural-language business question into a *computed* answer over the
real DataFrame — rankings, trends, anomalies, forecasts, correlations,
breakdowns, aggregations — plus an optional chart specification the frontend
renders with Plotly. Every number returned comes from the data (no fabrication).
A separate step (ai_service.narrate) can rephrase these facts with an LLM when
one is configured, but the facts themselves are always real.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

# Column-name hints for picking the most business-relevant numeric measure.
MEASURE_HINTS = [
    "revenue", "sales", "amount", "total", "profit", "price", "cost",
    "value", "quantity", "qty", "count", "spend", "income", "margin",
]
DATE_HINTS = ["date", "time", "month", "day", "year", "week", "period", "timestamp"]


@dataclass
class AnalysisResult:
    answer: str
    chart: dict[str, Any] | None = None
    facts: list[str] = field(default_factory=list)

    @property
    def result_type(self) -> str:
        return "chart" if self.chart else "text"


# --- Preparation & column selection ----------------------------------------

def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce obviously-numeric and obviously-date text columns for analysis."""
    out = df.copy()
    for col in out.columns:
        if out[col].dtype != object:
            continue
        non_null = out[col].notna().sum()
        if non_null == 0:
            continue
        numeric = pd.to_numeric(out[col], errors="coerce")
        if numeric.notna().sum() >= 0.8 * non_null:
            out[col] = numeric
            continue
        if any(h in str(col).lower() for h in DATE_HINTS):
            parsed = pd.to_datetime(out[col], errors="coerce", format="mixed")
            if parsed.notna().sum() >= 0.6 * non_null:
                out[col] = parsed
    return out


def _numeric_cols(df: pd.DataFrame) -> list[str]:
    return [str(c) for c in df.select_dtypes(include="number").columns]


def _datetime_cols(df: pd.DataFrame) -> list[str]:
    return [str(c) for c in df.select_dtypes(include="datetime").columns]


def _categorical_cols(df: pd.DataFrame) -> list[str]:
    cols = []
    for c in df.select_dtypes(include=["object", "category"]).columns:
        nunique = df[c].nunique(dropna=True)
        if 1 < nunique <= max(50, len(df) // 2 + 1):
            cols.append(str(c))
    return cols


def _find_mentioned(question: str, candidates: list[str]) -> str | None:
    q = question.lower()
    # Longest name first so "unit price" beats "price".
    for col in sorted(candidates, key=len, reverse=True):
        if col.lower() in q:
            return col
    return None


def _pick_measure(df: pd.DataFrame, question: str) -> str | None:
    numeric = _numeric_cols(df)
    if not numeric:
        return None
    mentioned = _find_mentioned(question, numeric)
    if mentioned:
        return mentioned
    for hint in MEASURE_HINTS:
        for col in numeric:
            if hint in col.lower():
                return col
    # Otherwise the highest-variance numeric column is usually the "interesting" one.
    variances = {c: float(df[c].var(skipna=True) or 0) for c in numeric}
    return max(variances, key=variances.get)


def _pick_category(df: pd.DataFrame, question: str) -> str | None:
    cats = _categorical_cols(df)
    if not cats:
        return None
    return _find_mentioned(question, cats) or min(cats, key=lambda c: df[c].nunique())


def _pick_datetime(df: pd.DataFrame, question: str) -> str | None:
    dates = _datetime_cols(df)
    if not dates:
        return None
    return _find_mentioned(question, dates) or dates[0]


def _fmt(value: float) -> str:
    if abs(value) >= 1000:
        return f"{value:,.0f}"
    return f"{value:,.2f}".rstrip("0").rstrip(".")


# --- Intent handlers --------------------------------------------------------

def _ranking(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    category = _pick_category(df, question)
    measure = _pick_measure(df, question)
    if not category or not measure:
        return None
    ascending = bool(re.search(r"lowest|worst|least|bottom|smallest", question, re.I))
    grouped = df.groupby(category, dropna=True)[measure].sum().sort_values(ascending=ascending)
    top = grouped.head(10)
    if top.empty:
        return None

    leader, leader_val = str(top.index[0]), float(top.iloc[0])
    total = float(grouped.sum()) or 1.0
    share = leader_val / total * 100
    direction = "lowest" if ascending else "highest"

    lines = [f"### {measure.title()} by {category}", "", f"| {category} | {measure} |", "| --- | ---: |"]
    lines += [f"| {idx} | {_fmt(float(val))} |" for idx, val in top.items()]
    lines.append("")
    lines.append(
        f"**{leader}** has the {direction} {measure} at **{_fmt(leader_val)}**, "
        f"{'the smallest' if ascending else f'{share:.1f}% of'} the total."
    )
    chart = {
        "type": "bar",
        "title": f"{measure.title()} by {category}",
        "x": [str(i) for i in top.index],
        "series": [{"name": measure, "values": [float(v) for v in top.values]}],
        "x_title": category,
        "y_title": measure,
    }
    return AnalysisResult("\n".join(lines), chart)


def _trend(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    date_col = _pick_datetime(df, question)
    measure = _pick_measure(df, question)
    if not measure:
        return None
    if not date_col:
        return None

    freq = "W" if re.search(r"week", question, re.I) else "D" if re.search(r"daily|per day", question, re.I) else "ME"
    series = (
        df[[date_col, measure]].dropna().set_index(date_col).sort_index()[measure].resample(freq).sum()
    )
    series = series[series.index.notna()]
    if len(series) < 2:
        return None

    first, last = float(series.iloc[0]), float(series.iloc[-1])
    change = (last - first) / abs(first) * 100 if first else 0.0
    peak_idx = series.idxmax()
    trough_idx = series.idxmin()
    trend_word = "increased" if change > 1 else "decreased" if change < -1 else "stayed flat"

    answer = (
        f"### {measure.title()} trend\n\n"
        f"Over the period, **{measure}** {trend_word} by **{change:+.1f}%** "
        f"(from {_fmt(first)} to {_fmt(last)}).\n\n"
        f"- Peak: **{_fmt(float(series.max()))}** on {peak_idx.date()}\n"
        f"- Low: **{_fmt(float(series.min()))}** on {trough_idx.date()}"
    )
    chart = {
        "type": "line",
        "title": f"{measure.title()} over time",
        "x": [d.date().isoformat() for d in series.index],
        "series": [{"name": measure, "values": [float(v) for v in series.values]}],
        "x_title": "Date",
        "y_title": measure,
    }
    return AnalysisResult(answer, chart)


def _forecast(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    measure = _pick_measure(df, question)
    if not measure:
        return None
    date_col = _pick_datetime(df, question)
    if date_col:
        s = df[[date_col, measure]].dropna().set_index(date_col).sort_index()[measure].resample("ME").sum()
        series = s[s.index.notna()]
        labels = [d.date().isoformat() for d in series.index]
    else:
        series = df[measure].dropna().reset_index(drop=True)
        labels = [str(i) for i in range(len(series))]
    if len(series) < 3:
        return None

    y = series.to_numpy(dtype=float)
    x = np.arange(len(y))
    slope, intercept = np.polyfit(x, y, 1)
    horizon = 6
    future_x = np.arange(len(y), len(y) + horizon)
    forecast = slope * future_x + intercept
    growth = slope / (abs(y.mean()) or 1) * 100

    future_labels = [f"+{i + 1}" for i in range(horizon)]
    answer = (
        f"### {measure.title()} forecast\n\n"
        f"Projecting a linear trend, **{measure}** is expected to reach "
        f"**{_fmt(float(forecast[-1]))}** in {horizon} periods "
        f"({'growing' if slope > 0 else 'declining'} ~{growth:+.1f}% per period on average).\n\n"
        f"_Method: ordinary least-squares trend fit on {len(y)} observed periods._"
    )
    chart = {
        "type": "line",
        "title": f"{measure.title()} forecast",
        "x": labels + future_labels,
        "series": [
            {"name": "History", "values": [float(v) for v in y] + [None] * horizon},
            {"name": "Forecast", "values": [None] * len(y) + [float(v) for v in forecast]},
        ],
        "x_title": "Period",
        "y_title": measure,
    }
    return AnalysisResult(answer, chart)


def _anomaly(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    numeric = _numeric_cols(df)
    if not numeric:
        return None
    findings: list[tuple[str, int, float, float]] = []
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
        if count:
            findings.append((col, count, float(low), float(high)))
    if not findings:
        return AnalysisResult(
            "### Anomaly scan\n\nNo statistical outliers were detected across the numeric "
            "columns using the IQR (1.5×) rule. The data looks consistent."
        )

    findings.sort(key=lambda f: f[1], reverse=True)
    lines = ["### Anomaly detection", "", "Outliers found using the IQR (1.5×) rule:", ""]
    lines += [f"- **{col}**: {count} outlier(s) outside [{_fmt(low)}, {_fmt(high)}]" for col, count, low, high in findings]

    top_col = findings[0][0]
    s = df[top_col].dropna().reset_index(drop=True)
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    is_out = (s < low) | (s > high)
    chart = {
        "type": "scatter",
        "title": f"Outliers in {top_col}",
        "x": [int(i) for i in s.index],
        "series": [
            {"name": "Normal", "values": [float(v) if not o else None for v, o in zip(s, is_out)]},
            {"name": "Outlier", "values": [float(v) if o else None for v, o in zip(s, is_out)]},
        ],
        "x_title": "Row",
        "y_title": top_col,
    }
    return AnalysisResult("\n".join(lines), chart)


def _correlation(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    numeric = _numeric_cols(df)
    if len(numeric) < 2:
        return None
    corr = df[numeric].corr(numeric_only=True)
    pairs = []
    for i, a in enumerate(numeric):
        for b in numeric[i + 1 :]:
            val = corr.loc[a, b]
            if pd.notna(val):
                pairs.append((a, b, float(val)))
    if not pairs:
        return None
    pairs.sort(key=lambda p: abs(p[2]), reverse=True)
    top = pairs[:5]

    lines = ["### Correlation analysis", "", "Strongest relationships between numeric columns:", ""]
    for a, b, v in top:
        strength = "strong" if abs(v) > 0.7 else "moderate" if abs(v) > 0.4 else "weak"
        lines.append(f"- **{a}** ↔ **{b}**: {v:+.2f} ({strength} {'positive' if v > 0 else 'negative'})")

    chart = {
        "type": "heatmap",
        "title": "Correlation matrix",
        "x_labels": numeric,
        "y_labels": numeric,
        "z": [[None if pd.isna(corr.loc[a, b]) else round(float(corr.loc[a, b]), 3) for b in numeric] for a in numeric],
    }
    return AnalysisResult("\n".join(lines), chart)


def _breakdown(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    category = _pick_category(df, question)
    measure = _pick_measure(df, question)
    if not category:
        return None
    if measure:
        grouped = df.groupby(category, dropna=True)[measure].sum().sort_values(ascending=False).head(8)
        title, label = f"{measure.title()} share by {category}", measure
    else:
        grouped = df[category].value_counts().head(8)
        title, label = f"Distribution of {category}", "count"
    if grouped.empty:
        return None
    total = float(grouped.sum()) or 1.0
    lines = [f"### {title}", ""]
    lines += [f"- **{idx}**: {_fmt(float(val))} ({float(val) / total * 100:.1f}%)" for idx, val in grouped.items()]
    chart = {
        "type": "pie",
        "title": title,
        "x": [str(i) for i in grouped.index],
        "series": [{"name": label, "values": [float(v) for v in grouped.values]}],
    }
    return AnalysisResult("\n".join(lines), chart)


def _distribution(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    measure = _pick_measure(df, question)
    if not measure:
        return None
    s = df[measure].dropna()
    if s.empty:
        return None
    counts, edges = np.histogram(s.to_numpy(dtype=float), bins=min(12, max(3, s.nunique())))
    mean, std = float(s.mean()), float(s.std())
    answer = (
        f"### Distribution of {measure}\n\n"
        f"- Mean: **{_fmt(mean)}**, Std dev: **{_fmt(std)}**\n"
        f"- Range: **{_fmt(float(s.min()))}** to **{_fmt(float(s.max()))}**\n"
        f"- Median: **{_fmt(float(s.median()))}**"
    )
    chart = {
        "type": "bar",
        "title": f"Distribution of {measure}",
        "x": [f"{_fmt(float(edges[i]))}" for i in range(len(counts))],
        "series": [{"name": "Frequency", "values": [int(c) for c in counts]}],
        "x_title": measure,
        "y_title": "Frequency",
    }
    return AnalysisResult(answer, chart)


def _aggregate(df: pd.DataFrame, question: str) -> AnalysisResult | None:
    measure = _pick_measure(df, question)
    if not measure:
        return None
    s = df[measure].dropna()
    if s.empty:
        return None
    if re.search(r"average|mean", question, re.I):
        op, val = "average", float(s.mean())
    elif re.search(r"count|how many", question, re.I):
        op, val = "count", float(s.count())
    elif re.search(r"max|highest|peak", question, re.I):
        op, val = "maximum", float(s.max())
    elif re.search(r"min|lowest", question, re.I):
        op, val = "minimum", float(s.min())
    else:
        op, val = "total", float(s.sum())
    return AnalysisResult(f"The **{op} {measure}** is **{_fmt(val)}** across {int(s.count())} records.")


def _summary(df: pd.DataFrame, question: str) -> AnalysisResult:
    rows, cols = len(df), len(df.columns)
    numeric = _numeric_cols(df)
    category = _pick_category(df, question)
    measure = _pick_measure(df, question)
    missing_pct = float(df.isna().sum().sum()) / (rows * max(cols, 1)) * 100 if rows else 0.0
    duplicates = int(df.duplicated().sum())

    lines = ["### Key insights", "", f"- **{rows:,} rows** across **{cols} columns**"]
    if measure:
        s = df[measure].dropna()
        if not s.empty:
            lines.append(f"- Total **{measure}**: **{_fmt(float(s.sum()))}** (avg {_fmt(float(s.mean()))})")
    if category and measure:
        grouped = df.groupby(category, dropna=True)[measure].sum().sort_values(ascending=False)
        if not grouped.empty:
            lines.append(f"- Top **{category}**: **{grouped.index[0]}** ({_fmt(float(grouped.iloc[0]))})")
    lines.append(f"- Data completeness: **{100 - missing_pct:.1f}%**" + (f", {duplicates} duplicate row(s)" if duplicates else ""))

    recs = ["", "### Recommendations", ""]
    if missing_pct > 5:
        recs.append(f"- Address missing data ({missing_pct:.1f}% of cells) before deeper modeling.")
    if duplicates:
        recs.append(f"- Remove {duplicates} duplicate row(s) to avoid skewed aggregates.")
    if category and measure:
        recs.append(f"- Focus on the leading **{category}** segments driving **{measure}**.")
    if len(numeric) >= 2:
        recs.append("- Explore correlations between numeric metrics to find growth drivers.")
    if len(recs) == 3:
        recs.append("- The dataset looks clean — proceed to trend and forecast analysis.")

    chart = None
    if category and measure:
        grouped = df.groupby(category, dropna=True)[measure].sum().sort_values(ascending=False).head(6)
        if not grouped.empty:
            chart = {
                "type": "bar",
                "title": f"Top {category} by {measure}",
                "x": [str(i) for i in grouped.index],
                "series": [{"name": measure, "values": [float(v) for v in grouped.values]}],
                "x_title": category,
                "y_title": measure,
            }
    return AnalysisResult("\n".join(lines + recs), chart)


# --- Router -----------------------------------------------------------------

_INTENTS = [
    (r"forecast|predict|projection|next (quarter|month|year|week)|future|will .* be", _forecast),
    (r"anomal|outlier|unusual|abnormal|suspicious|fraud", _anomaly),
    (r"trend|over time|monthly|weekly|daily|seasonal|growth|time.?series|by month|by day|by week", _trend),
    (r"top|highest|lowest|best|worst|most|least|rank|leading", _ranking),
    (r"correlat|relationship|related|associat|driver|depend", _correlation),
    (r"distribution|spread|histogram|frequency|how .* spread", _distribution),
    (r"breakdown|share|proportion|split|by (category|region|product|segment|type)|compare|composition", _breakdown),
    (r"total|sum|average|mean|count|how many|how much|maximum|minimum", _aggregate),
    (r"summar|overview|insight|key (finding|metric)|executive|recommend|tell me about|analy", _summary),
]


def analyze(df: pd.DataFrame, question: str) -> AnalysisResult:
    """Route a question to the best analysis over the real DataFrame."""
    if df is None or df.empty:
        return AnalysisResult("The dataset appears to be empty, so there is nothing to analyze.")
    prepared = _prepare(df)

    for pattern, handler in _INTENTS:
        if re.search(pattern, question, re.I):
            try:
                result = handler(prepared, question)
            except Exception:  # noqa: BLE001 - never break the chat on an analysis edge case
                result = None
            if result is not None:
                return result

    # Fallback: always return a real, computed summary.
    return _summary(prepared, question)
