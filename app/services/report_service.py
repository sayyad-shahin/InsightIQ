from typing import Any

from app.models.dataset import Dataset


def build_report_sections(dataset: Dataset, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Compose an executive-summary report from metadata computed during dataset
    profiling. `extra` may carry AI-generated insights/highlights computed from
    the DataFrame at report-creation time (see the reports endpoint).
    """
    schema = dataset.schema_snapshot or {}
    quality = dataset.quality_report or {}
    columns = schema.get("columns", [])

    overview = {
        "dataset_name": dataset.name,
        "source_type": dataset.source_type.value,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "status": dataset.status.value,
    }

    data_quality = {
        "total_rows": quality.get("total_rows"),
        "duplicate_rows": quality.get("duplicate_rows", 0),
        "columns_with_missing_values": list((quality.get("missing_values") or {}).keys()),
        "columns_with_outliers": list((quality.get("outliers") or {}).keys()),
        "recommendations": quality.get("suggestions", []),
    }

    sections: dict[str, Any] = {
        "overview": overview,
        "schema": {"columns": columns},
        "data_quality": data_quality,
    }
    if extra:
        sections.update(extra)
    return sections


def executive_summary(df) -> dict[str, Any]:
    """Compute AI-style insights + headline highlights from the real DataFrame."""
    from app.services.analytics_service import build_analytics

    analytics = build_analytics(df)
    highlights: dict[str, Any] = {
        "quality_score": analytics["kpis"]["quality_score"],
        "primary_measure": analytics["primary_measure"],
    }
    if analytics["trend"]:
        highlights["trend_change_pct"] = analytics["trend"]["change_pct"]
    if analytics["kpis"]["measures"]:
        primary = next((m for m in analytics["kpis"]["measures"] if m["is_primary"]), analytics["kpis"]["measures"][0])
        highlights["primary_total"] = primary["total"]
    return {"insights": analytics["insights"], "highlights": highlights}
