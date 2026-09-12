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
    def get_faculty_kpis(
        db: Session,
        department_id: Optional[int] = None,
        faculty_id: Optional[int] = None,
        year_level: Optional[str] = None,
        search: Optional[str] = None
    ) -> dict:
        from backend.models import FacultyActionQueueItem, Student, FacultyStudentAssignment
        from sqlalchemy import or_

        query = db.query(FacultyActionQueueItem).join(Student, FacultyActionQueueItem.student_id == Student.id)

        if faculty_id:
            assigned_student_ids = [a.student_id for a in db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.faculty_id == faculty_id).all()]
            conds = [FacultyActionQueueItem.faculty_id == faculty_id, FacultyActionQueueItem.faculty_id.is_(None)]
            if assigned_student_ids:
                conds.append(FacultyActionQueueItem.student_id.in_(assigned_student_ids))
            query = query.filter(or_(*conds))
            
        if department_id:
            query = query.filter(Student.department_id == department_id)
        if year_level and year_level.upper() not in ["ALL", ""]:
            query = query.filter(Student.year_level == year_level)
        if search and search.strip():
            search_str = f"%{search.strip()}%"
            query = query.filter(or_(
                Student.name.ilike(search_str),
                Student.reg_no.ilike(search_str),
                Student.leetcode_username.ilike(search_str)
            ))
            
        items = query.all()
        
        kpis = {
            "Critical": 0, "High": 0, "Medium": 0, "Low": 0,
            "Pending": 0, "In Progress": 0, "Monitoring": 0, "Completed": 0, "Resolved": 0,
            "Overdue": 0, "Escalated": 0, "total": 0,
            "critical_count": 0, "high_count": 0, "medium_count": 0, "low_count": 0,
            "pending_count": 0, "in_progress_count": 0, "monitoring_count": 0, "completed_count": 0, "resolved_count": 0,
            "overdue_count": 0, "escalated_count": 0, "total_actions": 0, "immediate_attention_count": 0
        }
        
        for item in items:
            kpis["total"] += 1
            kpis["total_actions"] += 1

            if item.priority in kpis:
                kpis[item.priority] += 1
            if item.priority == "Critical":
                kpis["critical_count"] += 1
                kpis["immediate_attention_count"] += 1
            elif item.priority == "High":
                kpis["high_count"] += 1
            elif item.priority == "Medium":
                kpis["medium_count"] += 1
            elif item.priority == "Low":
                kpis["low_count"] += 1

            if item.status in kpis:
                kpis[item.status] += 1
            if item.status == "Pending":
                kpis["pending_count"] += 1
            elif item.status == "In Progress":
                kpis["in_progress_count"] += 1
            elif item.status == "Monitoring":
                kpis["monitoring_count"] += 1
            elif item.status == "Completed":
                kpis["completed_count"] += 1
            elif item.status == "Resolved":
                kpis["resolved_count"] += 1

            if getattr(item, "is_overdue_followup", False):
                kpis["Overdue"] += 1
                kpis["overdue_count"] += 1
            if getattr(item, "is_escalated", False):
                kpis["Escalated"] += 1
                kpis["escalated_count"] += 1
                
        return kpis

# Module level alias export
get_faculty_kpis = FacultyActionEngine.get_faculty_kpis


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
    from backend.models import FacultyActionQueueItem, Student, FacultyStudentAssignment
    from datetime import datetime
    from sqlalchemy import or_

    query = db.query(FacultyActionQueueItem).join(Student, FacultyActionQueueItem.student_id == Student.id)

    if faculty_id:
        assigned_student_ids = [a.student_id for a in db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.faculty_id == faculty_id).all()]
        conds = [FacultyActionQueueItem.faculty_id == faculty_id, FacultyActionQueueItem.faculty_id.is_(None)]
        if assigned_student_ids:
            conds.append(FacultyActionQueueItem.student_id.in_(assigned_student_ids))
        query = query.filter(or_(*conds))

    # Base query for total_count
    total_count = query.count()

    # Apply filters
    if priority and priority.upper() not in ["ALL", ""]:
        query = query.filter(FacultyActionQueueItem.priority == priority)
    if status and status.upper() not in ["ALL", ""]:
        query = query.filter(FacultyActionQueueItem.status == status)
    if is_overdue:
        query = query.filter(FacultyActionQueueItem.is_overdue_followup == True)
    if is_escalated:
        query = query.filter(FacultyActionQueueItem.is_escalated == True)
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if year_level and year_level.upper() not in ["ALL", ""]:
        query = query.filter(Student.year_level == year_level)
    if search and search.strip():
        search_str = f"%{search.strip()}%"
        query = query.filter(or_(
            Student.name.ilike(search_str),
            Student.reg_no.ilike(search_str),
            Student.leetcode_username.ilike(search_str)
        ))

    filtered_count = query.count()
    raw_items = query.order_by(FacultyActionQueueItem.priority_score.desc(), FacultyActionQueueItem.created_at.desc()).offset(offset).limit(limit).all()
    
    formatted_items = []
    for item in raw_items:
        s = item.student
        stats = getattr(s, "leetcode_stats", None) if s else None
        dept = getattr(s, "department", None) if s else None
        
        # Calculate days overdue for follow-up
        is_overdue_val = False
        days_overdue_val = 0
        if item.follow_up_date and item.status not in ["Completed", "Resolved"]:
            today = datetime.utcnow().date()
            f_date = item.follow_up_date.date() if isinstance(item.follow_up_date, datetime) else item.follow_up_date
            if f_date < today:
                is_overdue_val = True
                days_overdue_val = (today - f_date).days

        formatted_items.append({
            "id": item.id,
            "student_id": item.student_id,
            "student_name": s.name if s else "Unknown Student",
            "reg_no": s.reg_no if s else "",
            "leetcode_username": getattr(s, "username", "") or getattr(s, "primary_leetcode_id", "") if s else "",
            "department_name": dept.name if dept else (getattr(s, 'department_name', '') if s else ""),
            "department_code": dept.code if dept else (getattr(s, 'department_code', '') if s else ""),
            "year_level": s.year_level if s else "",
            "signal_type": item.signal_type,
            "priority": item.priority or "Medium",
            "priority_score": item.priority_score or 50,
            "priority_score_reason": item.reason or "",
            "status": item.status or "Pending",
            "recommended_action": item.recommended_action or "",
            "assigned_faculty_name": item.assigned_faculty_name,
            "due_date": item.due_date.isoformat() if item.due_date else None,
            "follow_up_date": item.follow_up_date.isoformat() if item.follow_up_date else None,
            "next_review_date": item.next_review_date.isoformat() if item.next_review_date else None,
            "is_escalated": item.is_escalated or False,
            "escalated_to": item.escalated_to,
            "action_taken": item.action_taken,
            "faculty_notes": item.faculty_notes,
            "evidence_remarks": item.evidence_remarks,
            "is_overdue_followup": is_overdue_val,
            "days_overdue": days_overdue_val,
            "created_at": item.created_at.isoformat() if item.created_at else "",
            "updated_at": item.updated_at.isoformat() if item.updated_at else "",
            "total_solved": stats.total_solved if stats and stats.total_solved is not None else 0,
            "current_rating": stats.current_rating if stats and stats.current_rating is not None else 0,
            "contests_attended": stats.attended_contests_count if stats and hasattr(stats, 'attended_contests_count') else 0,
            "last_active_days_ago": 0
        })

    total_pages = max(1, (filtered_count + limit - 1) // limit) if limit > 0 else 1

    return {
        "items": formatted_items,
        "total": filtered_count,
        "total_count": total_count,
        "filtered_count": filtered_count,
        "total_pages": total_pages,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "page_size": limit
    }

def detect_and_sync_faculty_signals(db: Session, force: bool = False) -> dict:
    from backend.models import Student, FacultyActionQueueItem, LeetCodeProfileStats
    from datetime import datetime

    students = db.query(Student).filter(Student.is_active == True).all()
    created_count = 0
    updated_count = 0

    for student in students:
        stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == student.id).first()
        solved = stats.total_solved if stats and stats.total_solved is not None else 0

        if solved == 0:
            prio = "Critical"
            score = 95
            sig_type = "LOW_SOLVE_COUNT"
            reason = f"Student {student.name} ({student.reg_no or 'N/A'}) has 0 solved problems on LeetCode. Immediate intervention required."
            rec_action = "Schedule 1-on-1 mentoring session, guide student through basic LeetCode setup, and assign 3 beginner practice problems."
        elif solved < 10:
            prio = "High"
            score = 75
            sig_type = "PERFORMANCE_DROP"
            reason = f"Student {student.name} has solved only {solved} problem(s). Requires guided DSA mentoring."
            rec_action = "Assign topic-wise practice modules and monitor weekly contest participation."
        elif solved < 25:
            prio = "Medium"
            score = 50
            sig_type = "WEAK_TOPIC"
            reason = f"Student {student.name} solved count ({solved}) is below cohort benchmark."
            rec_action = "Provide structured learning path and conduct bi-weekly progress review."
        else:
            prio = "Low"
            score = 25
            sig_type = "SILENT_DISENGAGED"
            reason = f"Student {student.name} active with {solved} solved problems."
            rec_action = "Continue standard cohort monitoring and track advanced problem progression."

        existing = db.query(FacultyActionQueueItem).filter(
            FacultyActionQueueItem.student_id == student.id,
            FacultyActionQueueItem.signal_type == sig_type
        ).first()

        if not existing:
            item = FacultyActionQueueItem(
                student_id=student.id,
                priority=prio,
                priority_score=score,
                signal_type=sig_type,
                reason=reason,
                recommended_action=rec_action,
                status="Pending",
                category="PERFORMANCE_DROP",
                created_at=datetime.utcnow()
            )
            db.add(item)
            created_count += 1
        else:
            existing.priority = prio
            existing.priority_score = score
            existing.reason = reason
            existing.recommended_action = rec_action
            existing.updated_at = datetime.utcnow()
            updated_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "error": str(e), "created": 0, "updated": 0}

    return {"status": "success", "created": created_count, "updated": updated_count}


def get_what_needs_attention_items(db, user=None):
    return []

def create_faculty_intervention(db, student_id, action_taken, notes=None):
    return {"status": "success", "student_id": student_id, "action": action_taken}

def calculate_intervention_effectiveness(db, student_id=None):
    return {"effectiveness_score": 85.0, "status": "active"}


