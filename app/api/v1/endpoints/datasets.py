import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.cache import cache_get, cache_set, dataset_key, invalidate_dataset
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.db.session import get_db
from app.models.dataset import Dataset, DatasetStatus, SourceType
from app.models.user import User
from app.schemas.dataset import (
    CleaningOperations,
    CleaningPreviewResponse,
    DatasetDetail,
    DatasetPreviewResponse,
    DatasetRead,
    DatasetRename,
)
from app.services.analytics_service import build_analytics
from app.services.audit_service import record_action
from app.services.dataset_service import (
    CLEANED_SUFFIX,
    MAX_PREVIEW_LIMIT,
    UnsupportedDatasetError,
    build_preview,
    build_quality_report,
    build_schema_snapshot,
    clean_dataframe,
    compute_statistics,
    delete_parsed_artifacts,
    df_to_parquet_bytes,
    get_owned_dataset,
    is_cleaned_path,
    load_analysis_dataframe,
    load_dataframe,
    original_path_for,
    save_dataframe_csv,
    write_parsed_artifact,
)
from app.services.storage_service import copy_dataset_file, delete_file, save_upload
from app.utils.file_validation import (
    detect_source_type,
    validate_content_type,
    validate_declared_size,
)
from app.workers.tasks.dataset_tasks import process_dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_UPLOAD)
def upload_dataset(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    source_type = detect_source_type(file.filename)
    validate_content_type(file.content_type)
    validate_declared_size(file)

    storage_path = save_upload(current_user.id, file, source_type)

    dataset = Dataset(
        owner_id=current_user.id,
        name=file.filename,
        source_type=source_type,
        storage_path=str(storage_path),
        status=DatasetStatus.UPLOADED,
    )
    db.add(dataset)
    db.flush()
    record_action(
        db,
        "dataset.upload",
        user_id=current_user.id,
        metadata={"dataset_id": str(dataset.id), "filename": file.filename},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()  # dataset row + audit row commit together
    db.refresh(dataset)

    # Queue async profiling; if the broker is unavailable, don't fail the upload —
    # the row is persisted and the task can be re-dispatched.
    try:
        process_dataset.delay(str(dataset.id))
    except Exception as exc:  # noqa: BLE001 - broker/connection errors shouldn't 500 the upload
        logger.error(f"Failed to enqueue processing for dataset {dataset.id}: {exc}")

    return dataset


@router.get("", response_model=list[DatasetRead])
def list_datasets(
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Dataset]:
    return list(
        db.scalars(
            select(Dataset)
            .where(Dataset.owner_id == current_user.id)
            .order_by(Dataset.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )


def _get_owned_dataset(db: Session, dataset_id: uuid.UUID, current_user: User) -> Dataset:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}", response_model=DatasetDetail)
def get_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    return _get_owned_dataset(db, dataset_id, current_user)


def _load_owned_dataframe(dataset: Dataset):
    """Load a ready dataset into a DataFrame, mapping failures to HTTP errors."""
    if dataset.status not in (DatasetStatus.CLEANED, DatasetStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready (status: {dataset.status.value})",
        )
    try:
        return load_analysis_dataframe(dataset)
    except UnsupportedDatasetError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Underlying file is no longer available"
        ) from exc


@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=MAX_PREVIEW_LIMIT),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    df = _load_owned_dataframe(dataset)
    return build_preview(df, limit=limit)


@router.get("/{dataset_id}/statistics")
@limiter.limit(settings.RATE_LIMIT_COMPUTE)
def get_statistics(
    request: Request,
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    key = dataset_key("statistics", str(dataset_id), dataset.updated_at)
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = compute_statistics(_load_owned_dataframe(dataset))
    cache_set(key, result)
    return result


@router.get("/{dataset_id}/analytics")
@limiter.limit(settings.RATE_LIMIT_COMPUTE)
def get_analytics(
    request: Request,
    dataset_id: uuid.UUID,
    measure: str | None = Query(default=None),
    dimension: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    key = dataset_key("analytics", str(dataset_id), dataset.updated_at, measure or "", dimension or "")
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = build_analytics(_load_owned_dataframe(dataset), measure=measure, dimension=dimension)
    cache_set(key, result)
    return result


@router.get("/{dataset_id}/quality-report")
def get_quality_report(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    if dataset.quality_report is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Quality report is not available yet; the dataset may still be processing",
        )
    return dataset.quality_report


@router.patch("/{dataset_id}", response_model=DatasetRead)
def rename_dataset(
    dataset_id: uuid.UUID,
    payload: DatasetRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    dataset.name = payload.name
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.post("/{dataset_id}/duplicate", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def duplicate_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    source = _get_owned_dataset(db, dataset_id, current_user)
    try:
        new_path = copy_dataset_file(current_user.id, source.storage_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Underlying file is no longer available"
        ) from exc

    duplicate = Dataset(
        owner_id=current_user.id,
        name=f"{source.name} (copy)",
        source_type=source.source_type,
        storage_path=str(new_path),
        status=source.status,
        row_count=source.row_count,
        column_count=source.column_count,
        schema_snapshot=source.schema_snapshot,
        quality_report=source.quality_report,
    )
    db.add(duplicate)
    db.flush()
    record_action(db, "dataset.duplicate", user_id=current_user.id, metadata={"source_id": str(source.id)})
    db.commit()
    db.refresh(duplicate)
    return duplicate


@router.get("/{dataset_id}/download")
def download_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    path = Path(dataset.storage_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="File is no longer available")
    return FileResponse(path, filename=dataset.name, media_type="application/octet-stream")


def _reprofile(dataset: Dataset, df) -> None:
    """Recompute metadata after a cleaning apply/undo."""
    dataset.row_count = len(df)
    dataset.column_count = len(df.columns)
    dataset.schema_snapshot = build_schema_snapshot(df)
    dataset.quality_report = build_quality_report(df)
    dataset.status = DatasetStatus.CLEANED
    dataset.error_message = None


@router.post("/{dataset_id}/clean/preview", response_model=CleaningPreviewResponse)
@limiter.limit(settings.RATE_LIMIT_COMPUTE)
def preview_cleaning(
    request: Request,
    dataset_id: uuid.UUID,
    operations: CleaningOperations,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    original = original_path_for(dataset.storage_path)
    source_type = detect_source_type(Path(original).name)
    try:
        df = load_dataframe(Path(original), source_type)
    except (UnsupportedDatasetError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    cleaned, summary = clean_dataframe(df, operations.model_dump())
    return {"summary": summary, "preview": build_preview(cleaned, limit=100)}


@router.post("/{dataset_id}/clean/apply", response_model=DatasetDetail)
@limiter.limit(settings.RATE_LIMIT_COMPUTE)
def apply_cleaning(
    request: Request,
    dataset_id: uuid.UUID,
    operations: CleaningOperations,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    # Always derive from the canonical original so re-cleaning is idempotent.
    original = original_path_for(dataset.storage_path)
    source_type = detect_source_type(Path(original).name)
    try:
        df = load_dataframe(Path(original), source_type)
    except (UnsupportedDatasetError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    cleaned, summary = clean_dataframe(df, operations.model_dump())
    cleaned_path = f"{original}{CLEANED_SUFFIX}"
    save_dataframe_csv(cleaned, Path(cleaned_path))
    write_parsed_artifact(cleaned, cleaned_path)

    dataset.storage_path = cleaned_path
    dataset.source_type = SourceType.CSV
    dataset.parsed_artifact = df_to_parquet_bytes(cleaned)  # durable copy (ephemeral disks)
    _reprofile(dataset, cleaned)
    db.add(dataset)
    db.flush()
    record_action(
        db, "dataset.clean", user_id=current_user.id, metadata={"dataset_id": str(dataset.id), **summary}
    )
    db.commit()  # dataset update + audit row commit together
    db.refresh(dataset)
    invalidate_dataset(str(dataset.id))
    return dataset


@router.post("/{dataset_id}/clean/undo", response_model=DatasetDetail)
def undo_cleaning(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    if not is_cleaned_path(dataset.storage_path):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This dataset has no cleaning to undo"
        )

    cleaned_path = dataset.storage_path
    original = original_path_for(cleaned_path)
    source_type = detect_source_type(Path(original).name)
    try:
        df = load_dataframe(Path(original), source_type)
    except (UnsupportedDatasetError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=str(exc)) from exc

    dataset.storage_path = original
    dataset.source_type = source_type
    _reprofile(dataset, df)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    delete_file(cleaned_path)
    delete_parsed_artifacts(cleaned_path)
    invalidate_dataset(str(dataset.id))
    return dataset


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    delete_file(dataset.storage_path)
    delete_parsed_artifacts(dataset.storage_path)
    if is_cleaned_path(dataset.storage_path):
        original = original_path_for(dataset.storage_path)
        delete_file(original)
        delete_parsed_artifacts(original)
    invalidate_dataset(str(dataset.id))
    db.delete(dataset)
    db.commit()
