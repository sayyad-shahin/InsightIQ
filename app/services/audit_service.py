import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def record_action(
    db: Session,
    action: str,
    user_id: uuid.UUID | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        log_metadata=metadata,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
