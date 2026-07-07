import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.utils.file_validation import generate_storage_filename


def user_upload_dir(user_id: uuid.UUID) -> Path:
    path = Path(settings.UPLOAD_DIR) / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(user_id: uuid.UUID, file: UploadFile) -> Path:
    """Stream an UploadFile to disk under a per-user directory and return its path."""
    destination_dir = user_upload_dir(user_id)
    destination_path = destination_dir / generate_storage_filename(file.filename or "upload")

    with destination_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return destination_path


def report_output_path(report_id: uuid.UUID) -> Path:
    path = Path(settings.REPORT_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{report_id}.pdf"


def delete_file(path: str) -> None:
    file_path = Path(path)
    if file_path.exists():
        file_path.unlink()
