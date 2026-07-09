import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import logger
from app.models.dataset import SourceType
from app.utils.file_validation import (
    generate_storage_filename,
    max_upload_bytes,
    sniff_magic_bytes,
)

_CHUNK_SIZE = 1024 * 1024  # 1 MiB


def user_upload_dir(user_id: uuid.UUID) -> Path:
    path = Path(settings.UPLOAD_DIR) / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(user_id: uuid.UUID, file: UploadFile, source_type: SourceType) -> Path:
    """
    Stream an UploadFile to disk under a per-user directory, enforcing the size
    limit as bytes arrive (not trusting the client-declared Content-Length) and
    sniffing the leading bytes to reject spoofed file types. Partial files are
    removed on any failure so no oversized or invalid data is left behind.
    """
    destination_dir = user_upload_dir(user_id)
    destination_path = destination_dir / generate_storage_filename(file.filename or "upload")
    limit = max_upload_bytes()
    written = 0
    first_chunk = True

    try:
        with destination_path.open("wb") as buffer:
            while True:
                chunk = file.file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                if first_chunk:
                    sniff_magic_bytes(chunk[:16], source_type)
                    first_chunk = False
                written += len(chunk)
                if written > limit:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit",
                    )
                buffer.write(chunk)
    except Exception:
        destination_path.unlink(missing_ok=True)
        raise

    if written == 0:
        destination_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    logger.info(f"Stored upload for user {user_id}: {destination_path.name} ({written} bytes)")
    return destination_path


def copy_dataset_file(user_id: uuid.UUID, source_path: str) -> Path:
    """Copy an existing stored file to a new uniquely-named path (for duplication)."""
    src = Path(source_path)
    destination_dir = user_upload_dir(user_id)
    destination_path = destination_dir / f"{uuid.uuid4().hex}_{src.name}"
    shutil.copy2(src, destination_path)
    return destination_path


def report_output_path(report_id: uuid.UUID) -> Path:
    path = Path(settings.REPORT_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{report_id}.pdf"


def delete_file(path: str | None) -> None:
    if not path:
        return
    file_path = Path(path)
    try:
        file_path.unlink(missing_ok=True)
    except OSError as exc:  # pragma: no cover - best-effort cleanup
        logger.warning(f"Failed to delete file {path}: {exc}")
