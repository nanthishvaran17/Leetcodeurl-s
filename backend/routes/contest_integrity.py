from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime
import uuid

from backend.database import get_db
from backend.models import IntegrityCase, Student, User, AttendanceSnapshot, AttendanceCorrectionEvent, NotificationEvent
from backend.security import get_current_user_optional
from backend.services.contest_integrity_service import ContestIntegrityService
from backend.services.integrity_audit_service import IntegrityAuditService

router = APIRouter(prefix="/admin/integrity", tags=["Contest Integrity"])

class CaseReviewRequest(BaseModel):
    status: Optional[str] = None
    action: Optional[str] = None
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None

class AdminCorrectionRequest(BaseModel):
    old_value: str
    new_value: str
    reason: str
    staff_id: str

def verify_staff_access(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Helper to verify staff/admin security access on backend routes."""
    if not request:
        return None
    user = get_current_user_optional(request, db)
    if user:
        role = (user.role or "").strip().lower()
        allowed_roles = [
            "admin", "administrator", "super admin", "super_admin",
            "hod", "department hod", "department_hod", "head of department", "head_of_department",
            "faculty", "faculty mentor", "faculty_mentor",
            "staff", "staff mentor", "staff_mentor", "professor"
        ]
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied: Staff or Admin role required")
    return user

@router.post("/evaluate/{contest_id}")
def evaluate_contest(contest_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Evaluates Dual-ID compliance rules for all students in a specific contest.
    Requires Staff or Admin access.
    """
    verify_staff_access(request, db)
    audit_service = IntegrityAuditService(db)
    audit_service.log_event("EVALUATION_STARTED", contest_id=contest_id, created_by="STAFF_API")

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity(contest_id)

    audit_service.log_event("EVALUATION_COMPLETED", contest_id=contest_id, details={"cases_count": len(cases)})
    return {"contest_id": contest_id, "cases_evaluated": len(cases), "cases": cases}

@router.post("/scan")
def trigger_integrity_scan(request: Request, db: Session = Depends(get_db)):
    """
    Triggers full Dual-ID integrity scan across all active contests.
    """
    verify_staff_access(request, db)
    service = ContestIntegrityService(db)
    cases = service.evaluate_all_contests()
    return {"message": "Integrity scan completed", "cases_flagged": len(cases)}

@router.get("/cases")
def get_cases(request: Request, status: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns all integrity cases for the Staff Dashboard.
    Auto-evaluates active contests if 0 cases exist.
    """
    user = verify_staff_access(request, db)
    if db.query(IntegrityCase).count() == 0:
        service = ContestIntegrityService(db)
        service.evaluate_all_contests()

    from backend.services.authorization_service import _STAFF_ROLES, _HOD_ROLES, _normalize_role
    role_clean = _normalize_role(user)
    assigned_ids = None
    authorized_dept_ids = None
    if user and role_clean in _STAFF_ROLES:
        from backend.services.faculty_assignment_service import FacultyAssignmentService
        assigned_ids = set(FacultyAssignmentService.get_faculty_assigned_student_ids(db, user.id))
    elif user and role_clean in _HOD_ROLES:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        authorized_dept_ids = set(get_hod_authorized_department_ids(db, user))
        if not authorized_dept_ids and user.department_id:
            authorized_dept_ids = {user.department_id}

    query = db.query(IntegrityCase)
    if status and status != "ALL":
        query = query.filter(IntegrityCase.status == status)
        
    cases = query.order_by(IntegrityCase.created_at.desc()).all()
    
    results = []
    for c in cases:
        pid = c.people_id or ""
        clean_reg = pid.replace("UNKNOWN_REG_", "").replace("ID-REVIEW-REG-", "")
        student = db.query(Student).filter(
            (Student.people_id == c.people_id) | 
            (Student.reg_no == c.people_id) | 
            (Student.reg_no == clean_reg)
        ).first()

        # Strict Role-based Mentee Scope
        if assigned_ids is not None:
            if not student or student.id not in assigned_ids:
                continue
        elif authorized_dept_ids is not None:
            if not student or student.department_id not in authorized_dept_ids:
                continue
        
        student_name = student.name if student else (f"Student ({clean_reg})" if clean_reg else "Unknown")
        dept_id = student.department_id if student else None
        dept_name = student.department.name if student and student.department else None
        display_pid = (student.people_id or student.reg_no) if student else c.people_id

        part_statuses = c.participation_statuses or {}
        results.append({
            "id": c.id,
            "case_id": c.case_id,
            "people_id": display_pid,
            "reg_no": student.reg_no if student else clean_reg,
            "student_name": student_name,
            "department_id": dept_id,
            "department_name": dept_name,
            "contest_id": c.contest_id,
            "account_ids": c.account_ids,
            "participation_statuses": part_statuses,
            "why_this_alert": part_statuses.get("why_this_alert") or "Two different contest accounts are linked to the same People ID with confirmed NOT_ATTENDED status.",
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "reviewed_by": c.reviewed_by,
            "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
            "student_email_sent": c.student_email_sent,
            "staff_email_sent": c.staff_email_sent,
            "staff_push_sent": c.staff_push_sent,
            "audit_history": c.audit_history or []
        })
        
    return results

@router.api_route("/cases/{case_id}/review", methods=["PUT", "POST"])
def review_case(case_id: str, req: CaseReviewRequest, request: Request, db: Session = Depends(get_db)):
    """
    Allows Staff/Admin to review and resolve an IntegrityCase.
    Supports both PUT and POST methods, and status/action field names.
    """
    user = verify_staff_access(request, db)
    case = db.query(IntegrityCase).filter(IntegrityCase.case_id == case_id).first()
    if not case and case_id.isdigit():
        case = db.query(IntegrityCase).filter(IntegrityCase.id == int(case_id)).first()

    if not case:
        raise HTTPException(status_code=404, detail=f"Integrity case '{case_id}' not found")
        
    target_status = req.status or req.action
    if not target_status or target_status not in ["CONFIRMED", "DISMISSED", "PENDING", "IDENTITY_REVIEW_REQUIRED"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be CONFIRMED, DISMISSED, PENDING, or IDENTITY_REVIEW_REQUIRED")
        
    reviewer_name = str(req.reviewed_by or (user.full_name if user else "Staff Mentor"))
    case.status = target_status
    case.reviewed_by = reviewer_name
    case.reviewed_at = datetime.datetime.now(datetime.timezone.utc)

    history = list(case.audit_history or [])
    history.append({
        "event": f"STATUS_CHANGED_TO_{target_status}",
        "reviewed_by": reviewer_name,
        "notes": req.notes or f"Action marked as {target_status} from Integrity Console",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    })
    case.audit_history = history

    audit_service = IntegrityAuditService(db)
    audit_service.log_event(
        event_type=f"CASE_RESOLVED_{target_status}",
        contest_id=str(case.contest_id) if case.contest_id else None,
        people_id=str(case.people_id) if case.people_id else None,
        details={"case_id": case.case_id, "status": target_status, "reviewer": reviewer_name, "notes": req.notes},
        created_by=reviewer_name
    )
    
    db.commit()
    db.refresh(case)
    return {"message": "Case review updated successfully", "case_id": case.case_id, "status": case.status}

@router.post("/cases/{case_id}/correct")
def administrative_correction(case_id: str, req: AdminCorrectionRequest, request: Request, db: Session = Depends(get_db)):
    """
    Records an audited administrative correction to a frozen attendance snapshot.
    Does NOT silently mutate history — creates an immutable CorrectionEvent.
    """
    verify_staff_access(request, db)
    case = db.query(IntegrityCase).filter(IntegrityCase.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Integrity case not found")

    snapshot = db.query(AttendanceSnapshot).filter(
        AttendanceSnapshot.contest_id == case.contest_id,
        AttendanceSnapshot.people_id == case.people_id
    ).first()

    audit_id = f"CORR-{uuid.uuid4().hex[:8].upper()}"
    correction = AttendanceCorrectionEvent(
        audit_id=audit_id,
        snapshot_id=snapshot.id if snapshot else 0,
        contest_id=case.contest_id,
        people_id=case.people_id,
        old_value=req.old_value,
        new_value=req.new_value,
        reason=req.reason,
        staff_id=req.staff_id,
        timestamp=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(correction)

    audit_service = IntegrityAuditService(db)
    audit_service.log_event(
        event_type="ADMINISTRATIVE_CORRECTION",
        contest_id=case.contest_id,
        people_id=case.people_id,
        details={"audit_id": audit_id, "old_value": req.old_value, "new_value": req.new_value, "reason": req.reason, "staff_id": req.staff_id},
        created_by=req.staff_id
    )

    db.commit()
    return {"message": "Administrative correction recorded", "audit_id": audit_id}

@router.get("/outbox-events")
def get_outbox_events(request: Request, db: Session = Depends(get_db)):
    """Retrieves notification outbox events for monitoring."""
    verify_staff_access(request, db)
    events = db.query(NotificationEvent).order_by(NotificationEvent.created_at.desc()).limit(100).all()
    return [
        {
            "event_id": e.notification_event_id,
            "case_id": e.case_id,
            "people_id": e.people_id,
            "recipient_type": e.recipient_type,
            "channel": e.channel,
            "target": e.recipient_target,
            "status": e.status,
            "attempt_count": e.attempt_count,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None,
            "idempotency_key": e.idempotency_key,
            "error_message": e.error_message
        }
        for e in events
    ]

@router.get("/audit-logs")
def get_audit_logs(
    request: Request, 
    event_type: Optional[str] = None, 
    contest_id: Optional[str] = None, 
    people_id: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """Retrieves system audit logs."""
    verify_staff_access(request, db)
    audit_service = IntegrityAuditService(db)
    return audit_service.get_logs(event_type=event_type, contest_id=contest_id, people_id=people_id)
