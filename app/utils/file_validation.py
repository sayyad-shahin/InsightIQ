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

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def detect_source_type(filename: str) -> SourceType:
    suffix = PurePosixPath(filename).suffix.lower()
    source_type = ALLOWED_EXTENSIONS.get(suffix)
    if source_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    return source_type


def sanitize_filename(filename: str) -> str:
    base = PurePosixPath(filename).name  # strip any directory components
    return _SAFE_NAME_RE.sub("_", base) or "upload"


def validate_upload_size(file: UploadFile) -> None:
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    # UploadFile.size is populated by Starlette from the multipart stream.
    if file.size is not None and file.size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit",
        )


def generate_storage_filename(original_filename: str) -> str:
    safe_name = sanitize_filename(original_filename)
    return f"{uuid.uuid4().hex}_{safe_name}"
