import re
import sqlite3
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.models.dataset import Dataset, SourceType

MAX_PREVIEW_ROWS = 50
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
