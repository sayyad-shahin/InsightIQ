import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.dataset import Dataset, DatasetStatus
from app.models.user import User
from app.schemas.dataset import DatasetDetail, DatasetPreviewResponse, DatasetRead
from app.services.audit_service import record_action
from app.services.dataset_service import UnsupportedDatasetError, build_preview, load_dataframe
from app.services.storage_service import delete_file, save_upload
from app.utils.file_validation import detect_source_type, validate_upload_size
from app.workers.tasks.dataset_tasks import process_dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    source_type = detect_source_type(file.filename)
    validate_upload_size(file)

    storage_path = save_upload(current_user.id, file)

    dataset = Dataset(
        owner_id=current_user.id,
        name=file.filename,
        source_type=source_type,
        storage_path=str(storage_path),
        status=DatasetStatus.UPLOADED,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    process_dataset.delay(str(dataset.id))

    record_action(
        db,
        "dataset.upload",
        user_id=current_user.id,
        metadata={"dataset_id": str(dataset.id), "filename": file.filename},
        ip_address=request.client.host if request.client else None,
    )

    return dataset


@router.get("", response_model=list[DatasetRead])
def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Dataset]:
    return list(
        db.scalars(
            select(Dataset).where(Dataset.owner_id == current_user.id).order_by(Dataset.created_at.desc())
        )
    )


def _get_owned_dataset(db: Session, dataset_id: uuid.UUID, current_user: User) -> Dataset:
    dataset = db.get(Dataset, dataset_id)
    if not dataset or dataset.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}", response_model=DatasetDetail)
def get_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dataset:
    return _get_owned_dataset(db, dataset_id, current_user)


@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    dataset = _get_owned_dataset(db, dataset_id, current_user)

    if dataset.status not in (DatasetStatus.CLEANED, DatasetStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset is not ready for preview (status: {dataset.status.value})",
        )

    try:
        from pathlib import Path

        df = load_dataframe(Path(dataset.storage_path), dataset.source_type)
    except UnsupportedDatasetError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return build_preview(df)


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


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    dataset = _get_owned_dataset(db, dataset_id, current_user)
    delete_file(dataset.storage_path)
    db.delete(dataset)
    db.commit()
