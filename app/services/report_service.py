from typing import Any

from app.models.dataset import Dataset


def build_report_sections(dataset: Dataset) -> dict[str, Any]:
    """
    Compose an executive-summary report from metadata already computed during
    dataset profiling. Synchronous and dependency-free — richer narrative /
    PDF rendering can be layered on later without changing this contract.
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

    return {
        "overview": overview,
        "schema": {"columns": columns},
        "data_quality": data_quality,
    }
