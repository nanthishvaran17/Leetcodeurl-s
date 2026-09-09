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

    @staticmethod
    def get_faculty_kpis(db: Session, department_id: Optional[int] = None, faculty_id: Optional[int] = None, year_level: Optional[str] = None, search: Optional[str] = None) -> dict:
        query = db.query(FacultyActionItem)
        
        # We need to join with Student to filter by department_id, year_level, search
        if department_id or faculty_id or year_level or search:
            query = query.join(Student, FacultyActionItem.student_id == Student.id)
            
        if department_id:
            query = query.filter(Student.department_id == department_id)
        if faculty_id:
            from backend.models import FacultyStudentAssignment
            query = query.join(FacultyStudentAssignment, Student.id == FacultyStudentAssignment.student_id).filter(
                FacultyStudentAssignment.faculty_id == faculty_id
            )
        if year_level and year_level.upper() not in ["ALL", ""]:
            query = query.filter(Student.year_level == year_level)
        if search:
            query = query.filter(Student.name.ilike(f"%{search}%") | Student.reg_no.ilike(f"%{search}%"))
            
        items = query.all()
        
        kpis = {
            "Critical": 0, "High": 0, "Monitoring": 0, "In Progress": 0, 
            "Completed": 0, "Resolved": 0, "Overdue": 0, "Escalated": 0, "total": 0
        }
        
        for item in items:
            kpis["total"] += 1
            if item.status in kpis:
                kpis[item.status] += 1
            
            # Simple priority bucket logic based on signal_type or status
            if item.signal_type == "RISK_ALERT":
                kpis["Critical"] += 1
            elif item.signal_type == "INTEGRITY_REVIEW":
                kpis["High"] += 1
                
        return kpis

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



def get_faculty_actions_list(
    db: Session,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    year_level: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    faculty_id: Optional[int] = None,
    is_overdue: Optional[bool] = None,
    is_escalated: Optional[bool] = None,
) -> dict:
    from backend.models import FacultyActionQueueItem, Student
    from sqlalchemy import or_

    query = db.query(FacultyActionQueueItem)
    if department_id or year_level or search:
        query = query.join(Student, FacultyActionQueueItem.student_id == Student.id)

    if faculty_id:
        query = query.filter(FacultyActionQueueItem.faculty_id == faculty_id)
        
    # Authorized base dataset for total_count
    base_query = query
    total_count = base_query.count()

    # Apply filters
    if priority:
        query = query.filter(FacultyActionQueueItem.priority == priority)
    if status:
        query = query.filter(FacultyActionQueueItem.status == status)
    if is_overdue:
        query = query.filter(FacultyActionQueueItem.is_overdue_followup == True)
    if is_escalated:
        query = query.filter(FacultyActionQueueItem.is_escalated == True)
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if year_level and year_level.upper() not in ["ALL", ""]:
        query = query.filter(Student.year_level == year_level)
    if search:
        search_str = f"%{search.strip()}%"
        query = query.filter(or_(
            Student.name.ilike(search_str),
            Student.reg_no.ilike(search_str),
            Student.leetcode_username.ilike(search_str)
        ))

    filtered_count = query.count()
    items = query.order_by(FacultyActionQueueItem.created_at.desc()).offset(offset).limit(limit).all()
    
    # Calculate pages
    total_pages = max(1, (filtered_count + limit - 1) // limit)

    return {
        "items": items,
        "total": filtered_count,
        "total_count": total_count,
        "filtered_count": filtered_count,
        "total_pages": total_pages,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "page_size": limit
    }

def detect_and_sync_faculty_signals(db: Session, force: bool = False) -> dict:
    return {"status": "success", "created": 0, "updated": 0}
