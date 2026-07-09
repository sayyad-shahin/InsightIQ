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
    # Flush (not commit) so the audit row participates in the caller's transaction
    # and is committed atomically with — or right after — the action it records.
    db.add(entry)
    db.flush()
    return entry
