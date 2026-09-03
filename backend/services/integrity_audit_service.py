from typing import Dict, Any, List, Optional
import datetime
from sqlalchemy.orm import Session
from backend.models import AuditLogRecord

class IntegrityAuditService:
    def __init__(self, db: Session):
        self.db = db

    def log_event(
        self, 
        event_type: str, 
        contest_id: Optional[str] = None, 
        people_id: Optional[str] = None, 
        details: Optional[Dict[str, Any]] = None, 
        created_by: str = "SYSTEM"
    ) -> AuditLogRecord:
        """Records an immutable audit event in the database."""
        entry = AuditLogRecord(
            event_type=event_type,
            contest_id=contest_id,
            people_id=people_id,
            details=details or {},
            created_by=created_by,
            created_at=datetime.datetime.utcnow()
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_logs(
        self, 
        event_type: Optional[str] = None, 
        contest_id: Optional[str] = None, 
        people_id: Optional[str] = None, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieves audit log entries for UI display or audit review."""
        query = self.db.query(AuditLogRecord)
        if event_type:
            query = query.filter(AuditLogRecord.event_type == event_type)
        if contest_id:
            query = query.filter(AuditLogRecord.contest_id == contest_id)
        if people_id:
            query = query.filter(AuditLogRecord.people_id == people_id)

        entries = query.order_by(AuditLogRecord.created_at.desc()).limit(limit).all()

        return [
            {
                "id": e.id,
                "event_type": e.event_type,
                "contest_id": e.contest_id,
                "people_id": e.people_id,
                "details": e.details,
                "created_by": e.created_by,
                "created_at": e.created_at.isoformat() if e.created_at else None
            }
            for e in entries
        ]
