"""
Unified API Router for AI-Powered Institutional LeetCode Coding Intelligence Platform
Exposes endpoints for Risk Prediction, Explainable AI, Faculty Action Queue, Interventions,
Student Coding Profile, DSA Map, Learning Paths, HOD Command Center, What-If Simulator,
Natural Language AI Query, and Alert Center.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime

from backend.database import get_db
from backend.models import Student, User, SystemAlert
from backend.security import require_role
from backend.services.student_risk_engine import calculate_student_risk_engine
from backend.services.learning_path_generator import generate_personalized_learning_path
from backend.services.contest_readiness_engine import get_digital_coding_profile
from backend.services.hod_analytics_engine import (
    calculate_department_health_score, get_institutional_benchmarks,
    get_hod_what_is_happening_summary, simulate_what_if_scenario
)
from backend.services.ai_query_engine import answer_ai_department_query

router = APIRouter(prefix="/api/intelligence", tags=["AI Coding Intelligence Platform"])

# Request Schemas
class CreateInterventionRequest(BaseModel):
    student_id: int
    faculty_id: Optional[int] = None
    title: str
    reason: str
    assigned_topics: List[str]
    priority: str = "High"

class UpdateInterventionRequest(BaseModel):
    status: str # Pending, In Progress, Completed, Monitoring, Resolved
    improvement_notes: Optional[str] = None

class WhatIfRequest(BaseModel):
    current_participation_pct: float = 72.0
    target_participation_pct: float = 87.0
    current_at_risk_count: int = 12

class AIQueryRequest(BaseModel):
    query: str


# ============================================================================
# 1. STUDENT CODING PROFILE & RISK ENGINE
# ============================================================================

@router.get("/student/{student_id}/digital-profile")
def get_student_digital_profile_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns full Digital Coding Profile, 16 DSA topic skill map, Contest Readiness,
    Consistency metrics, and Risk score for a student.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = get_digital_coding_profile(db, student)
    risk = calculate_student_risk_engine(db, student)
    learning_path = generate_personalized_learning_path(db, student)

    profile["risk_engine"] = risk
    profile["learning_path"] = learning_path
    return profile

@router.get("/student/{student_id}/risk")
def get_student_risk_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns Explainable AI Risk Score (0-100), Level, Evidence, Explanation & Recommended Action.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return calculate_student_risk_engine(db, student)

@router.get("/student/{student_id}/learning-path")
def get_student_learning_path_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns personalized 4-week adaptive learning plan.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return generate_personalized_learning_path(db, student)


# ============================================================================
# 2. FACULTY ACTION CENTER, INTERVENTIONS & MENTORING LIFECYCLE
# ============================================================================

class FacultyActionUpdateRequest(BaseModel):
    status: Optional[str] = None
    assigned_faculty_name: Optional[str] = None
    action_taken: Optional[str] = None
    faculty_notes: Optional[str] = None
    evidence_remarks: Optional[str] = None
    follow_up_date: Optional[datetime.date] = None
    next_review_date: Optional[datetime.date] = None
    user_name: Optional[str] = "Faculty Mentor"

class FacultyAssignRequest(BaseModel):
    assigned_faculty_name: str
    user_name: Optional[str] = "Faculty Mentor"

class FacultyStatusRequest(BaseModel):
    status: str
    reason: Optional[str] = None
    user_name: Optional[str] = "Faculty Mentor"

class FacultyNoteRequest(BaseModel):
    note: str
    action_taken: Optional[str] = None
    user_name: Optional[str] = "Faculty Mentor"

class FacultyFollowUpRequest(BaseModel):
    follow_up_date: datetime.date
    next_review_date: Optional[datetime.date] = None
    note: Optional[str] = None
    user_name: Optional[str] = "Faculty Mentor"

class FacultyEscalateRequest(BaseModel):
    escalated_to: str = "HOD"
    reason: str = "Unresolved critical performance risk"
    user_name: Optional[str] = "Faculty Mentor"


@router.get("/faculty/actions/kpis")
def get_faculty_kpis_endpoint(
    dept_id: Optional[int] = None,
    year_level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Returns real database KPI metrics scoped to the requesting user's role.
    Faculty/Staff: Only their assigned students.
    HOD/Admin: Full department or institution.
    """
    from backend.services.faculty_action_engine import get_faculty_kpis
    role_clean = (current_user.role or "").strip().lower()
    faculty_id = current_user.id if role_clean in ["faculty", "staff"] else None
    eff_dept_id = dept_id

    # HOD: enforce department scope — override any client-supplied dept_id
    if role_clean == "hod":
        if not current_user.department_id:
            return {"Critical": 0, "High": 0, "Monitoring": 0, "In Progress": 0, "Completed": 0, "Resolved": 0, "Overdue": 0, "Escalated": 0, "total": 0}
        eff_dept_id = current_user.department_id

    return get_faculty_kpis(db, department_id=eff_dept_id, faculty_id=faculty_id, year_level=year_level, search=search)


@router.get("/faculty/actions")
def get_faculty_actions_endpoint(
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    dept_id: Optional[int] = Query(None),
    year_level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    is_escalated: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query("priority_score"),
    sort_dir: Optional[str] = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    limit: Optional[int] = Query(None),
    offset: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Returns filtered and sorted Faculty Action Queue.
    Faculty/Staff see only their assigned students.
    HOD sees only their department's students.
    Admin sees all.
    """
    from backend.services.faculty_action_engine import get_faculty_actions_list, detect_and_sync_faculty_signals
    role_clean = (current_user.role or "").strip().lower()
    faculty_id = current_user.id if role_clean in ["faculty", "staff"] else None
    eff_dept_id = department_id or dept_id

    # HOD: enforce department scope — ignore any client-supplied dept_id
    if role_clean == "hod":
        if not current_user.department_id:
            # Fail closed — HOD without department sees nothing
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "kpi": {}}
        eff_dept_id = current_user.department_id  # always override

    eff_limit = limit if limit is not None else page_size
    eff_offset = offset if offset is not None else (page - 1) * page_size
    data = get_faculty_actions_list(
        db,
        priority=priority,
        status=status,
        department_id=eff_dept_id,
        year_level=year_level,
        search=search,
        limit=eff_limit,
        offset=eff_offset,
        faculty_id=faculty_id,
        is_overdue=is_overdue,
        is_escalated=is_escalated
    )
    if data["total"] == 0 and not search and not priority and not status:
        detect_and_sync_faculty_signals(db)
        data = get_faculty_actions_list(
            db,
            priority=priority,
            status=status,
            department_id=eff_dept_id,
            year_level=year_level,
            search=search,
            limit=eff_limit,
            offset=eff_offset,
            faculty_id=faculty_id,
            is_overdue=is_overdue,
            is_escalated=is_escalated
        )
    data["page"] = page
    data["page_size"] = eff_limit
    return data


@router.post("/faculty/actions/detect-signals")
def post_detect_faculty_signals_endpoint(
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Triggers on-demand automated signal sweep across all active students in the database.
    """
    from backend.services.faculty_action_engine import detect_and_sync_faculty_signals
    res = detect_and_sync_faculty_signals(db, force=force)
    return {
        "status": res.get("status", "success"),
        "new_signals_created": res.get("created", 0),
        "existing_signals_updated": res.get("updated", 0),
        "total_processed": res.get("created", 0) + res.get("updated", 0),
        "message": f"{res.get('created', 0)} new signals created, {res.get('updated', 0)} updated."
    }


@router.put("/faculty/actions/{action_id}")
def put_faculty_action_endpoint(
    action_id: int,
    req: FacultyActionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Updates action details (PUT), status, notes, follow-up date with audit trail.
    """
    from backend.services.faculty_action_engine import update_faculty_action_details
    try:
        return update_faculty_action_details(
            db,
            action_id=action_id,
            status=req.status,
            assigned_faculty_name=req.assigned_faculty_name,
            action_taken=req.action_taken,
            faculty_notes=req.faculty_notes,
            evidence_remarks=req.evidence_remarks,
            follow_up_date=req.follow_up_date,
            next_review_date=req.next_review_date,
            user_name=req.user_name or "Faculty Mentor"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/faculty/actions/{action_id}")
def get_single_faculty_action_endpoint(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Returns single action details with timeline and student metrics.
    """
    from backend.models import FacultyActionQueueItem, LeetCodeProfileStats
    from backend.services.faculty_action_engine import get_action_timeline

    item = db.query(FacultyActionQueueItem).filter(FacultyActionQueueItem.id == action_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action not found")

    # SECURITY: Faculty can only view their assigned students' cases
    role_clean = (current_user.role or "").strip().lower()
    if role_clean in ["faculty", "staff"]:
        from backend.models import FacultyStudentAssignment
        assignment = db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == current_user.id,
            FacultyStudentAssignment.student_id == item.student_id,
            FacultyStudentAssignment.is_active == True
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Access restricted: This student is not assigned to your mentorship.")

    st = item.student
    stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st.id).first() if st else None
    timeline = get_action_timeline(db, action_id)

    return {
        "id": item.id,
        "student_id": item.student_id,
        "reg_no": st.reg_no if st else "",
        "student_name": st.name if st else "",
        "department": st.department.name if (st and st.department) else "CSE",
        "year_level": st.year_level or "III",
        "leetcode_username": st.username or "",
        "priority": item.priority,
        "priority_score": item.priority_score,
        "signal_type": item.signal_type,
        "contest_id": item.contest_id,
        "reason": item.reason,
        "recommended_action": item.recommended_action,
        "status": item.status,
        "assigned_faculty_name": item.assigned_faculty_name,
        "due_date": item.due_date.strftime("%d %b %Y") if item.due_date else None,
        "follow_up_date": item.follow_up_date.strftime("%d %b %Y") if item.follow_up_date else None,
        "next_review_date": item.next_review_date.strftime("%d %b %Y") if item.next_review_date else None,
        "action_taken": item.action_taken,
        "faculty_notes": item.faculty_notes,
        "evidence_remarks": item.evidence_remarks,
        "is_escalated": item.is_escalated,
        "escalated_to": item.escalated_to,
        "stats": {
            "total_solved": stats.total_solved if stats else 0,
            "contest_rating": stats.contest_rating if stats else 0.0,
            "easy_solved": stats.easy_solved if stats else 0,
            "medium_solved": stats.medium_solved if stats else 0,
            "hard_solved": stats.hard_solved if stats else 0,
        },
        "timeline": timeline
    }


@router.patch("/faculty/actions/{action_id}")
def patch_faculty_action_endpoint(
    action_id: int,
    req: FacultyActionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Updates action details, status, notes, follow-up date with audit trail.
    """
    from backend.services.faculty_action_engine import update_faculty_action_details
    try:
        res = update_faculty_action_details(
            db,
            action_id=action_id,
            status=req.status,
            assigned_faculty_name=req.assigned_faculty_name,
            action_taken=req.action_taken,
            faculty_notes=req.faculty_notes,
            evidence_remarks=req.evidence_remarks,
            follow_up_date=req.follow_up_date,
            next_review_date=req.next_review_date,
            user_name=req.user_name or "Faculty Mentor"
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/faculty/actions/{action_id}/assign")
def post_assign_faculty_endpoint(
    action_id: int,
    req: FacultyAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Assigns faculty to an action.
    """
    from backend.services.faculty_action_engine import update_faculty_action_details
    try:
        return update_faculty_action_details(
            db,
            action_id=action_id,
            assigned_faculty_name=req.assigned_faculty_name,
            user_name=req.user_name or "Faculty Mentor"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/faculty/actions/{action_id}/status")
def post_status_faculty_endpoint(
    action_id: int,
    req: FacultyStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Updates action status with validation.
    """
    from backend.services.faculty_action_engine import update_faculty_action_details
    try:
        return update_faculty_action_details(
            db,
            action_id=action_id,
            status=req.status,
            faculty_notes=req.reason,
            user_name=req.user_name or "Faculty Mentor"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/faculty/actions/{action_id}/follow-up")
def post_follow_up_endpoint(
    action_id: int,
    req: FacultyFollowUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Schedules a follow-up review date.
    """
    from backend.services.faculty_action_engine import update_faculty_action_details
    try:
        return update_faculty_action_details(
            db,
            action_id=action_id,
            follow_up_date=req.follow_up_date,
            next_review_date=req.next_review_date,
            faculty_notes=req.note,
            user_name=req.user_name or "Faculty Mentor"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/faculty/actions/{action_id}/escalate")
def post_escalate_endpoint(
    action_id: int,
    req: FacultyEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Escalates an unresolved critical action to HOD.
    """
    from backend.services.faculty_action_engine import escalate_faculty_action
    try:
        return escalate_faculty_action(
            db,
            action_id=action_id,
            escalated_to=req.escalated_to,
            reason=req.reason,
            user_name=req.user_name or "Faculty Mentor"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/faculty/actions/{action_id}/timeline")
def get_action_timeline_endpoint(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("faculty", "staff", "hod", "admin", "super_admin", "super admin"))
):
    """
    Returns complete chronological event audit trail for an action.
    """
    from backend.services.faculty_action_engine import get_action_timeline
    return {"action_id": action_id, "timeline": get_action_timeline(db, action_id)}



# ============================================================================
# 3. HOD COMMAND CENTER & BENCHMARKING
# ============================================================================

@router.get("/hod/command-center")
def get_hod_command_center_endpoint(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns executive metrics for HOD Command Center, Department Health Score & Summary.
    """
    health = calculate_department_health_score(db, dept_id=dept_id)
    summary = get_hod_what_is_happening_summary(db, dept_id=dept_id)

    return {
        "department_health": health,
        "executive_summary": summary
    }

@router.get("/hod/benchmarks")
def get_hod_benchmarks_endpoint(db: Session = Depends(get_db)):
    """
    Returns Department vs Department & Year vs Year Benchmarks.
    """
    return get_institutional_benchmarks(db)

@router.post("/hod/what-if")
def post_what_if_simulator_endpoint(req: WhatIfRequest):
    """
    Simulates outcome of participation/growth changes for HOD.
    """
    return simulate_what_if_scenario(
        current_part_pct=req.current_participation_pct,
        target_part_pct=req.target_participation_pct,
        current_at_risk=req.current_at_risk_count
    )

@router.post("/hod/ai-query")
def post_ai_query_endpoint(req: AIQueryRequest, db: Session = Depends(get_db)):
    """
    Natural Language AI Department Query interface using verified DB analytics.
    """
    return answer_ai_department_query(db, query_text=req.query)


# ============================================================================
# 4. SYSTEM ALERT CENTER
# ============================================================================

@router.get("/alerts")
def get_system_alerts_endpoint(db: Session = Depends(get_db)):
    """
    Returns system alerts (Critical, Warning, Attention, Achievement).
    """
    alerts = db.query(SystemAlert).order_by(SystemAlert.id.desc()).all()
    if not alerts:
        # Seed initial priority alerts if empty
        seed_alerts = [
            SystemAlert(
                alert_type="CRITICAL",
                title="3 Students Dropped Performance >20%",
                message="Recent contest & weekly velocity dropped significantly across II Year section A.",
                action_label="Review Action Queue",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="WARNING",
                title="8 Students Inactive for 14+ Days",
                message="No problem solving recorded over the past two weeks.",
                action_label="View Inactive List",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="ATTENTION",
                title="12 Students Weak in Dynamic Programming",
                message="Topic accuracy below department baseline expectation (27% avg).",
                action_label="Assign Practice",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="ACHIEVEMENT",
                title="7 Students Solved 500+ Problems",
                message="Milestone reached in Cyber Security department.",
                action_label="View Spotlight",
                action_route="/leaderboard"
            )
        ]
        for a in seed_alerts:
            db.add(a)
        db.commit()
        alerts = db.query(SystemAlert).order_by(SystemAlert.id.desc()).all()

    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "title": a.title,
            "message": a.message,
            "action_label": a.action_label,
            "action_route": a.action_route,
            "is_read": a.is_read,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat() if a.created_at else ""
        } for a in alerts
    ]

@router.post("/alerts/{alert_id}/read")
def mark_alert_read_endpoint(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SystemAlert).filter(SystemAlert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"success": True}

@router.post("/alerts/{alert_id}/resolve")
def mark_alert_resolve_endpoint(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SystemAlert).filter(SystemAlert.id == alert_id).first()
    if alert:
        alert.is_resolved = True
        alert.is_read = True
        db.commit()
    return {"success": True}
