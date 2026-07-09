import re
import sqlite3
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.models.dataset import Dataset, SourceType

MAX_PREVIEW_ROWS = 50
MAX_PREVIEW_LIMIT = 200
_CREATE_TABLE_RE = re.compile(r"CREATE\s+TABLE\s+[`\"\[]?(\w+)[`\"\]]?", re.IGNORECASE)


class UnsupportedDatasetError(Exception):
    """Raised when a file cannot be parsed into tabular data."""


def get_owned_dataset(db: Session, dataset_id: uuid.UUID, user_id: uuid.UUID) -> Dataset | None:
    """Return the dataset only if it exists and belongs to the given user."""
    dataset = db.get(Dataset, dataset_id)
    if dataset is None or dataset.owner_id != user_id:
        return None
    return dataset


def load_dataframe(path: Path, source_type: SourceType) -> pd.DataFrame:
    if source_type == SourceType.CSV:
        return pd.read_csv(path)

    if source_type == SourceType.EXCEL:
        return pd.read_excel(path)

    if source_type == SourceType.SQL:
        return _load_dataframe_from_sql_script(path)

    if source_type == SourceType.PDF:
        return _load_dataframe_from_pdf(path)

    raise UnsupportedDatasetError(f"No parser registered for source type {source_type}")


def _load_dataframe_from_sql_script(path: Path) -> pd.DataFrame:
    """
    Executes a .sql script (CREATE TABLE + INSERT statements) against a
    disposable in-memory SQLite database, then returns the first table's
    contents as a DataFrame. This lets users hand us a portable SQL export
    without needing a live database connection.
    """
    script = path.read_text(encoding="utf-8", errors="ignore")

    # Block statements that could touch the host filesystem. The script is run in
    # a disposable in-memory SQLite DB, but ATTACH DATABASE could otherwise create
    # or write files at an arbitrary path.
    if re.search(r"\battach\s+database\b", script, re.IGNORECASE):
        raise UnsupportedDatasetError("ATTACH DATABASE statements are not permitted in uploaded SQL")

    match = _CREATE_TABLE_RE.search(script)
    if not match:
        raise UnsupportedDatasetError("No CREATE TABLE statement found in the uploaded SQL file")
    table_name = match.group(1)  # regex captures \w+ only, so it is safe to interpolate

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(script)
        return pd.read_sql_query(f'SELECT * FROM "{table_name}"', connection)
    except sqlite3.Error as exc:
        raise UnsupportedDatasetError(f"Failed to execute SQL script: {exc}") from exc
    finally:
        connection.close()


def _load_dataframe_from_pdf(path: Path) -> pd.DataFrame:
    """
    PDFs rarely contain clean tabular structure, so instead of guessing at
    table boundaries we extract page text and return it as a single-column
    DataFrame. This feeds the AI chat / RAG pipeline (as a text corpus)
    rather than the numeric EDA / forecasting pipeline.
    """
    reader = PdfReader(str(path))
    rows: list[dict[str, Any]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            rows.append({"page": page_number, "text": text.strip()})

    if not rows:
        raise UnsupportedDatasetError("No extractable text found in this PDF")

    return pd.DataFrame(rows)


def build_schema_snapshot(df: pd.DataFrame) -> dict[str, Any]:
    return {
        "columns": [
            {"name": str(col), "dtype": str(df[col].dtype)} for col in df.columns
        ]
    }


def build_quality_report(df: pd.DataFrame) -> dict[str, Any]:
    total_rows = len(df)
    missing_counts = df.isna().sum()
    missing_report = {
        str(col): {
            "missing_count": int(missing_counts[col]),
            "missing_pct": round(float(missing_counts[col]) / total_rows * 100, 2) if total_rows else 0.0,
        }
        for col in df.columns
        if missing_counts[col] > 0
    }

    duplicate_count = int(df.duplicated().sum())

    outliers: dict[str, int] = {}
    numeric_columns = df.select_dtypes(include="number").columns
    for col in numeric_columns:
        series = df[col].dropna()
        if series.empty:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outlier_count = int(((series < lower) | (series > upper)).sum())
        if outlier_count > 0:
            outliers[str(col)] = outlier_count

    suggestions: list[str] = []
    if missing_report:
        suggestions.append(
            "Impute or drop missing values in: " + ", ".join(missing_report.keys())
        )
    if duplicate_count:
        suggestions.append(f"Remove {duplicate_count} duplicate row(s)")
    if outliers:
        suggestions.append(
            "Review outliers detected via IQR in: " + ", ".join(outliers.keys())
        )
    if not suggestions:
        suggestions.append("No major data quality issues detected")

    return {
        "total_rows": total_rows,
        "missing_values": missing_report,
        "duplicate_rows": duplicate_count,
        "outliers": outliers,
        "suggestions": suggestions,
    }


def build_preview(df: pd.DataFrame, limit: int = MAX_PREVIEW_ROWS) -> dict[str, Any]:
    preview_df = df.head(limit)
    return {
        "columns": [str(col) for col in df.columns],
        "rows": preview_df.astype(object).where(pd.notna(preview_df), None).to_dict(orient="records"),
        "total_rows": len(df),
        "previewed_rows": len(preview_df),
    }


def quality_score(df: pd.DataFrame) -> int:
    """
    A 0–100 data-quality score derived from real metrics: missing cells,
    duplicate rows, and IQR outliers. Higher is cleaner.
    """
    total_rows = len(df)
    total_cells = total_rows * max(len(df.columns), 1)
    if total_rows == 0 or total_cells == 0:
        return 0

    missing_ratio = float(df.isna().sum().sum()) / total_cells
    duplicate_ratio = float(df.duplicated().sum()) / total_rows

    outlier_cells = 0
    for col in df.select_dtypes(include="number").columns:
        series = df[col].dropna()
        if series.empty:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outlier_cells += int(((series < lower) | (series > upper)).sum())
    outlier_ratio = outlier_cells / total_cells

    score = 100.0 - (missing_ratio * 40) - (duplicate_ratio * 35) - (outlier_ratio * 25) * 100
    return int(max(0, min(100, round(score))))


def compute_statistics(df: pd.DataFrame) -> dict[str, Any]:
    """Descriptive statistics, correlation matrix, and per-column distributions."""
    numeric = df.select_dtypes(include="number")

    statistics: dict[str, Any] = {}
    for col in numeric.columns:
        series = numeric[col].dropna()
        if series.empty:
            continue
        statistics[str(col)] = {
            "count": int(series.count()),
            "mean": round(float(series.mean()), 4),
            "std": round(float(series.std()), 4) if series.count() > 1 else 0.0,
            "min": round(float(series.min()), 4),
            "q25": round(float(series.quantile(0.25)), 4),
            "median": round(float(series.quantile(0.5)), 4),
            "q75": round(float(series.quantile(0.75)), 4),
            "max": round(float(series.max()), 4),
        }

    correlation: dict[str, Any] | None = None
    if numeric.shape[1] >= 2:
        corr = numeric.corr(numeric_only=True).round(4)
        correlation = {
            "columns": [str(c) for c in corr.columns],
            "matrix": [[None if pd.isna(v) else float(v) for v in row] for row in corr.to_numpy()],
        }

    distributions: dict[str, Any] = {}
    for col in df.columns:
        series = df[col]
        if col in numeric.columns:
            values = series.dropna()
            if values.empty:
                continue
            bin_count = int(min(10, max(1, values.nunique())))
            counts, edges = np.histogram(values.to_numpy(dtype=float), bins=bin_count)
            distributions[str(col)] = {
                "type": "numeric",
                "bins": [
                    {"start": round(float(edges[i]), 3), "end": round(float(edges[i + 1]), 3), "count": int(counts[i])}
                    for i in range(len(counts))
                ],
            }
        else:
            counts = series.astype(str).where(series.notna(), "—").value_counts().head(8)
            distributions[str(col)] = {
                "type": "categorical",
                "values": [{"value": str(k), "count": int(v)} for k, v in counts.items()],
            }

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "quality_score": quality_score(df),
        "statistics": statistics,
        "correlation": correlation,
        "distributions": distributions,
    }


# --- Smart data cleaning ----------------------------------------------------

CleaningOps = dict[str, Any]


def clean_dataframe(df: pd.DataFrame, ops: CleaningOps) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Apply real cleaning transformations and return (cleaned_df, summary).
    Order matters: normalize text/types/dates before dedup/fill so comparisons
    and imputations operate on the corrected values.
    """
    out = df.copy()
    applied: list[str] = []
    rows_before = len(out)
    missing_before = int(out.isna().sum().sum())
    duplicates_before = int(out.duplicated().sum())

    if ops.get("trim_whitespace"):
        for col in out.select_dtypes(include="object").columns:
            out[col] = out[col].map(lambda v: v.strip() if isinstance(v, str) else v)
        applied.append("Trimmed whitespace")

    if ops.get("convert_types"):
        converted_cols = []
        for col in out.select_dtypes(include="object").columns:
            non_null = out[col].notna().sum()
            if non_null == 0:
                continue
            coerced = pd.to_numeric(out[col], errors="coerce")
            if coerced.notna().sum() >= 0.8 * non_null:
                out[col] = coerced
                converted_cols.append(str(col))
        if converted_cols:
            applied.append(f"Converted to numeric: {', '.join(converted_cols)}")

    if ops.get("normalize_dates"):
        date_cols = []
        for col in out.select_dtypes(include="object").columns:
            non_null = out[col].notna().sum()
            if non_null == 0:
                continue
            parsed = pd.to_datetime(out[col], errors="coerce", format="mixed", dayfirst=False)
            if parsed.notna().sum() >= 0.8 * non_null:
                out[col] = parsed.dt.strftime("%Y-%m-%d")
                date_cols.append(str(col))
        if date_cols:
            applied.append(f"Normalized dates: {', '.join(date_cols)}")

    if ops.get("drop_empty_rows"):
        before = len(out)
        out = out.dropna(how="all").reset_index(drop=True)
        if before - len(out):
            applied.append(f"Removed {before - len(out)} empty row(s)")

    if ops.get("remove_duplicates"):
        before = len(out)
        out = out.drop_duplicates().reset_index(drop=True)
        if before - len(out):
            applied.append(f"Removed {before - len(out)} duplicate row(s)")

    if ops.get("fill_missing"):
        strategy = ops.get("fill_strategy", "auto")
        filled_cols = []
        for col in out.columns:
            if not out[col].isna().any():
                continue
            if pd.api.types.is_numeric_dtype(out[col]):
                if strategy == "mean":
                    value: Any = out[col].mean()
                elif strategy == "zero":
                    value = 0
                else:
                    value = out[col].median()
            else:
                mode = out[col].mode()
                value = mode.iloc[0] if not mode.empty else ""
            out[col] = out[col].fillna(value)
            filled_cols.append(str(col))
        if filled_cols:
            applied.append(f"Filled missing values in: {', '.join(filled_cols)}")

    summary = {
        "rows_before": rows_before,
        "rows_after": int(len(out)),
        "rows_removed": rows_before - int(len(out)),
        "missing_before": missing_before,
        "missing_after": int(out.isna().sum().sum()),
        "duplicates_before": duplicates_before,
        "duplicates_after": int(out.duplicated().sum()),
        "operations_applied": applied or ["No changes were necessary"],
    }
    return out, summary


def save_dataframe_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False)


CLEANED_SUFFIX = ".cleaned.csv"


def is_cleaned_path(storage_path: str) -> bool:
    return storage_path.endswith(CLEANED_SUFFIX)


def original_path_for(storage_path: str) -> str:
    """The canonical source file for a (possibly cleaned) dataset."""
    return storage_path[: -len(CLEANED_SUFFIX)] if is_cleaned_path(storage_path) else storage_path
