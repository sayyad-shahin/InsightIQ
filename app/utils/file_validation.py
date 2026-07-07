import re
import uuid
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models.dataset import SourceType

ALLOWED_EXTENSIONS: dict[str, SourceType] = {
    ".csv": SourceType.CSV,
    ".xlsx": SourceType.EXCEL,
    ".xls": SourceType.EXCEL,
    ".pdf": SourceType.PDF,
    ".sql": SourceType.SQL,
}

# Declared MIME types we accept. Browsers are inconsistent for CSV/SQL (often
# text/plain or application/octet-stream), so we allow those generic types and
# rely on extension + magic-byte sniffing for the real check.
ALLOWED_CONTENT_TYPES: set[str] = {
    "text/csv",
    "application/csv",
    "text/plain",
    "application/octet-stream",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
    "application/sql",
    "text/x-sql",
    "",
}

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")
_MAGIC_HEAD_BYTES = 8


def detect_source_type(filename: str) -> SourceType:
    suffix = PurePosixPath(filename).suffix.lower()
    source_type = ALLOWED_EXTENSIONS.get(suffix)
    if source_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return source_type


def validate_content_type(content_type: str | None) -> None:
    """Reject obviously wrong declared MIME types (best-effort; not authoritative)."""
    normalized = (content_type or "").split(";")[0].strip().lower()
    if normalized not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type '{content_type}'",
        )


def sniff_magic_bytes(head: bytes, source_type: SourceType) -> None:
    """
    Verify the file's leading bytes are consistent with its declared type.
    CSV/SQL are plain text and have no reliable signature, so we only guard the
    binary formats (PDF, Excel) where a mismatch clearly indicates spoofing.
    """
    if source_type == SourceType.PDF:
        if not head.startswith(b"%PDF"):
            _reject("File does not look like a valid PDF")
    elif source_type == SourceType.EXCEL:
        # .xlsx is a ZIP (PK\x03\x04); legacy .xls is an OLE2 compound file.
        if not (head.startswith(b"PK\x03\x04") or head.startswith(b"\xd0\xcf\x11\xe0")):
            _reject("File does not look like a valid Excel workbook")


def _reject(message: str) -> None:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)


def sanitize_filename(filename: str) -> str:
    base = PurePosixPath(filename).name  # strip any directory components (path traversal defense)
    return _SAFE_NAME_RE.sub("_", base) or "upload"


def generate_storage_filename(original_filename: str) -> str:
    safe_name = sanitize_filename(original_filename)
    return f"{uuid.uuid4().hex}_{safe_name}"


def max_upload_bytes() -> int:
    return settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def validate_declared_size(file: UploadFile) -> None:
    """Fast pre-flight rejection when the client declares an oversized upload."""
    if file.size is not None and file.size > max_upload_bytes():
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit",
        )
