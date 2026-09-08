from typing import List, Optional
from sqlalchemy.orm import Session
from backend.models import FacultyActionQueueItem as FacultyActionItem, Student, User
from fastapi import HTTPException

class FacultyActionEngine:
    @staticmethod
    def create_action_item(
        db: Session, 
        item_type: str, 
        student_id: int, 
        evidence: str, 
        notes: Optional[str] = None
    ) -> FacultyActionItem:
        item = FacultyActionItem(
            signal_type=item_type,
            student_id=student_id,
            reason=evidence,
            recommended_action="Review and take appropriate action",
            faculty_notes=notes,
            status="OPEN"
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_open_items_for_faculty(db: Session, user: User) -> List[FacultyActionItem]:
        # Based on RBAC, filter what the user can see.
        from backend.services.authorization_service import get_authorized_student_ids
        
        query = db.query(FacultyActionItem).filter(FacultyActionItem.status.in_(["OPEN", "IN_REVIEW", "Pending", "In Progress"]))
        
        authorized_ids = get_authorized_student_ids(db, user)
        if authorized_ids is not None:
            query = query.filter(FacultyActionItem.student_id.in_(authorized_ids))
            
        return query.order_by(FacultyActionItem.created_at.desc()).all()

    @staticmethod
    def update_action_item_status(db: Session, item_id: int, status: str, user: User, notes: Optional[str] = None) -> FacultyActionItem:
        item = db.query(FacultyActionItem).filter(FacultyActionItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Action item not found")
        
        # Verify access
        from backend.services.authorization_service import get_authorized_student_ids
        authorized_ids = get_authorized_student_ids(db, user)
        if authorized_ids is not None and item.student_id not in authorized_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this action item")

        if status not in ["OPEN", "IN_REVIEW", "DISMISSED", "ACTIONED", "Pending", "In Progress", "Monitoring", "Completed", "Resolved"]:
            raise HTTPException(status_code=400, detail="Invalid status")
            
        item.status = status
        item.faculty_id = user.id
        if notes:
            item.faculty_notes = notes
            
        db.commit()
        db.refresh(item)
        return item

class FacultyActionIngestion:
    """Ingests items from multiple sources into the Faculty Action Queue."""
    
    @staticmethod
    def ingest_risk_threshold_crossing(
        db: Session,
        student_id: int, 
        risk_score: float,
        threshold: float,
        context: dict
    ) -> FacultyActionItem:
        """Create queue item when risk_score > threshold."""
        import json
        from datetime import datetime
        
        evidence_data = {
            "risk_score": risk_score,
            "threshold": threshold,
            "calculation_version": context.get("version"),
            "contributing_factors": context.get("factors"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return FacultyActionEngine.create_action_item(
            db=db,
            item_type="RISK_ALERT",
            student_id=student_id,
            evidence=json.dumps(evidence_data)
        )
    
    @staticmethod
    def ingest_integrity_alert(
        db: Session,
        student_id: int, 
        similarity_data: dict
    ) -> FacultyActionItem:
        """Create queue item from integrity scan."""
        import json
        
        return FacultyActionEngine.create_action_item(
            db=db,
            item_type="INTEGRITY_REVIEW",
            student_id=student_id,
            evidence=json.dumps(similarity_data)
        )

    @staticmethod
    def ingest_anomaly_flag(
        db: Session,
        student_id: int,
        anomaly_data: dict
    ) -> FacultyActionItem:
        import json
        return FacultyActionEngine.create_action_item(
            db=db,
            item_type="ANOMALY_FLAG",
            student_id=student_id,
            evidence=json.dumps(anomaly_data)
        )

    @staticmethod
    def ingest_profile_mismatch(
        db: Session,
        student_id: int,
        mismatch_data: dict
    ) -> FacultyActionItem:
        import json
        return FacultyActionEngine.create_action_item(
            db=db,
            item_type="PROFILE_MISMATCH",
            student_id=student_id,
            evidence=json.dumps(mismatch_data)
        )


