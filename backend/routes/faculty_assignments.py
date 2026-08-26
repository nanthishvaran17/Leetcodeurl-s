"""
faculty_assignments.py — API Routes for Faculty-Student Allocation & Workload Tracking

Provides endpoints for managing 1:20 faculty-to-student assignments, workload distribution,
and faculty-scoped student lists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import User, Student, FacultyStudentAssignment, Department, LeetCodeProfileStats
from backend.security import require_security_access, require_role
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from backend.schemas import StudentOut
from backend.services.authorization_service import apply_role_based_student_filter
from backend.logger import logger

router = APIRouter(prefix="/faculty-assignments", tags=["Faculty Assignments"])


class AssignStudentsRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(..., min_length=1)


class UnassignStudentsRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(..., min_length=1)


class AutoDistributeRequest(BaseModel):
    department_id: int


@router.get("/my-students")
def get_my_assigned_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """
    Returns the full list of students strictly assigned to the authenticated faculty/staff member.
    Authorization is enforced via the faculty_student_assignments table — NOT via role-based
    department scope. This guarantees Staff A never sees Staff B's students even if both are
    in the same department or if the caller has HOD/Admin role.
    """
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)

    if not assigned_ids:
        return {
            "faculty_id": current_user.id,
            "faculty_name": current_user.username,
            "total_assigned": 0,
            "recommended_ratio": 20,
            "workload_status": "NORMAL",
            "students": []
        }

    # SECURITY: Filter strictly by assigned_ids — no role-based expansion.
    # apply_role_based_student_filter is intentionally NOT used here because it
    # would expand scope for HOD/Admin and would issue a second redundant query
    # to get_faculty_assigned_student_ids for Staff/Faculty roles (N+1 pattern).
    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(
        Student.id.in_(assigned_ids),
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).all()

    student_list = []
    for s in students:
        st_out = {
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "CSE",
            "year_level": s.year_level,
            "section": s.section.name if s.section else "A",
            "username": s.username,
            "leetcode_url": s.leetcode_url,
            "total_solved": s.stats.total_solved if s.stats else 0,
            "easy_solved": s.stats.easy_solved if s.stats else 0,
            "medium_solved": s.stats.medium_solved if s.stats else 0,
            "hard_solved": s.stats.hard_solved if s.stats else 0,
            "contest_rating": s.stats.contest_rating if s.stats else 0.0,
            "max_streak": s.stats.max_streak if s.stats else 0,
            "sync_status": s.stats.sync_status if s.stats else "not_started"
        }
        student_list.append(st_out)

    count = len(student_list)
    workload_status = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))

    return {
        "faculty_id": current_user.id,
        "faculty_name": current_user.username,
        "total_assigned": count,
        "recommended_ratio": 20,
        "workload_status": workload_status,
        "workload_warning": f"Above recommended ratio ({count}/20)" if count > 20 else None,
        "students": student_list
    }


@router.get("/faculty/{faculty_id}")
def get_faculty_assignments(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    HOD/Admin: Retrieves assigned students for a specific faculty member.
    HOD can only view faculty in their department.
    """
    faculty = db.query(User).filter(User.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    # HOD department check
    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: You can only view faculty within your own department."
        )

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, faculty_id)
    students = db.query(Student).filter(Student.id.in_(assigned_ids)).all() if assigned_ids else []

    return {
        "faculty_id": faculty.id,
        "faculty_name": faculty.username,
        "department_id": faculty.department_id,
        "total_assigned": len(students),
        "max_allowed": MAX_STUDENTS_PER_FACULTY,
        "slots_remaining": max(0, MAX_STUDENTS_PER_FACULTY - len(students)),
        "students": [
            {
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "department": s.department.code if s.department else "CSE",
                "year_level": s.year_level,
                "username": s.username,
                "total_solved": s.stats.total_solved if s.stats else 0
            }
            for s in students
        ]
    }


@router.post("/assign")
def assign_students(
    payload: AssignStudentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Assigns students to a faculty member.
    STRICTLY ENFORCES 1 Faculty -> Max 20 Students.
    """
    faculty = db.query(User).filter(User.id == payload.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Target faculty member not found.")

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only assign students to faculty in their own department."
        )

    return faculty_assignment_service.assign_students_to_faculty(
        db=db,
        faculty_id=payload.faculty_id,
        student_ids=payload.student_ids,
        assigned_by_id=current_user.id
    )


@router.post("/unassign")
def unassign_students(
    payload: UnassignStudentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """Removes student assignments from a faculty member."""
    return faculty_assignment_service.unassign_students(
        db=db,
        faculty_id=payload.faculty_id,
        student_ids=payload.student_ids
    )


@router.delete("/staff/{faculty_id}")
def delete_staff_member(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Deletes a staff member and automatically unassigns all their assigned students,
    returning them to the unassigned student allocation queue.
    """
    faculty = db.query(User).filter(User.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only delete staff members in their own department."
        )

    # 1. Unassign all students assigned to this faculty member
    unassigned_count = db.query(FacultyStudentAssignment).filter(
        FacultyStudentAssignment.faculty_id == faculty_id
    ).delete(synchronize_session=False)

    # 2. Delete the faculty user record
    faculty_name = faculty.username
    try:
        db.delete(faculty)
        db.commit()
    except Exception as e:
        # Fallback to Soft Delete if foreign keys (mentor notes, history, alerts) prevent physical deletion
        db.rollback()
        faculty.is_active = False
        faculty.role = "Deleted_Staff"
        
        # Anonymize to free up unique constraints (username, email, institutional_id)
        import time
        timestamp = int(time.time())
        faculty.email = f"deleted_{timestamp}_{faculty.email}"[:150]
        faculty.username = f"deleted_{timestamp}_{faculty.username}"[:100]
        if faculty.institutional_id:
            faculty.institutional_id = f"deleted_{timestamp}_{faculty.institutional_id}"[:50]
            
        db.commit()

    return {
        "success": True,
        "message": f"Staff member '{faculty_name}' deleted successfully. {unassigned_count} students returned to allocation queue.",
        "unassigned_count": unassigned_count
    }


@router.post("/auto-distribute")
def auto_distribute_students(
    payload: AutoDistributeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Auto-allocates unassigned department students to active department faculty
    up to 20 students per faculty member in round-robin fashion.
    """
    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != payload.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only auto-distribute students in their own department."
        )

    return faculty_assignment_service.auto_distribute_department(
        db=db,
        department_id=payload.department_id,
        assigned_by_id=current_user.id
    )


@router.get("/workload-summary")
def get_faculty_workload_summary(
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Returns faculty workload distribution (e.g. 18/20, 20/20) across a department.
    """
    user_role = (current_user.role or "").strip().lower()
    target_dept_id = current_user.department_id if user_role in ["hod"] else dept_id

    query = db.query(User).options(joinedload(User.department)).filter(
        User.is_active == True,
        User.role.in_(["Faculty", "faculty", "Staff", "staff", "HOD", "hod"])
    )
    if target_dept_id:
        query = query.filter(User.department_id == target_dept_id)

    faculty_list = query.all()

    # Efficient single grouped query for all active faculty student counts
    fac_ids = [f.id for f in faculty_list]
    count_rows = db.query(
        FacultyStudentAssignment.faculty_id,
        func.count(FacultyStudentAssignment.id)
    ).filter(
        FacultyStudentAssignment.faculty_id.in_(fac_ids),
        FacultyStudentAssignment.is_active == True
    ).group_by(FacultyStudentAssignment.faculty_id).all() if fac_ids else []

    assigned_counts = {r[0]: r[1] for r in count_rows}
    workload = []

    for fac in faculty_list:
        count = assigned_counts.get(fac.id, 0)
        status_code = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))
        status_label = "Normal" if count < 20 else ("At Ratio" if count == 20 else ("Above Ratio" if count <= 30 else "High Workload"))
        workload.append({
            "faculty_id": fac.id,
            "faculty_name": fac.username,
            "email": fac.email,
            "role": fac.role,
            "department_id": fac.department_id,
            "department_name": fac.department.name if fac.department else "General",
            "assigned_students": count,
            "recommended_ratio": 20,
            "workload_status": status_code,
            "workload_label": status_label,
            "is_above_ratio": count > 20
        })

    return {
        "total_faculty": len(faculty_list),
        "target_department_id": target_dept_id,
        "recommended_ratio_per_faculty": 20,
        "max_capacity_per_faculty": 30,
        "faculty_workload": workload
    }


# =========================================================================
# STAFF MENTORING & MONITORING ENDPOINTS
# =========================================================================

class NoteCreateRequest(BaseModel):
    student_id: int
    note: str
    escalation_level: Optional[str] = "NORMAL"


class FollowUpCreateRequest(BaseModel):
    student_id: int
    title: str
    due_date: str  # YYYY-MM-DD
    notes: Optional[str] = None


class FollowUpUpdateRequest(BaseModel):
    status: str  # PENDING, COMPLETED, CANCELLED
    notes: Optional[str] = None


class WeeklyTargetRequest(BaseModel):
    student_id: int
    target_problems: int = 10
    target_contests: int = 1


def calculate_student_performance_status(s: Student) -> Dict[str, Any]:
    """Helper to automatically classify student status & trend."""
    total = s.stats.total_solved if (s.stats and s.stats.total_solved is not None) else 0
    streak = s.stats.max_streak if (s.stats and s.stats.max_streak is not None) else 0
    rating = s.stats.contest_rating if (s.stats and s.stats.contest_rating is not None) else 0.0
    last_verified = s.stats.last_verified_at if s.stats else None

    days_inactive = 0
    if last_verified:
        now = datetime.datetime.now(datetime.timezone.utc)
        if last_verified.tzinfo is None:
            last_verified = last_verified.replace(tzinfo=datetime.timezone.utc)
        days_inactive = (now - last_verified).days

    if days_inactive >= 8 or (total == 0 and days_inactive >= 5):
        status_label = "At Risk"
        status_code = "AT_RISK"
        badge_color = "red"
    elif total < 30 or days_inactive >= 4:
        status_label = "Needs Improvement"
        status_code = "NEEDS_IMPROVEMENT"
        badge_color = "yellow"
    elif total >= 100 or streak >= 7 or rating >= 1400:
        status_label = "Excellent"
        status_code = "EXCELLENT"
        badge_color = "emerald"
    else:
        status_label = "Improving"
        status_code = "IMPROVING"
        badge_color = "blue"

    # Performance trend calculation based on recent records
    trend = "STABLE"
    trend_label = "➡️ Stable"

    if total > 50 and days_inactive <= 2:
        trend = "IMPROVING"
        trend_label = "📈 Improving"
    elif days_inactive >= 7:
        trend = "DECLINING"
        trend_label = "📉 Declining"

    return {
        "status_code": status_code,
        "status_label": status_label,
        "badge_color": badge_color,
        "days_inactive": days_inactive,
        "trend": trend,
        "trend_label": trend_label
    }


@router.get("/my-mentoring-summary")
def get_my_mentoring_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Returns summary KPIs for the authenticated mentor's assigned student portfolio."""
    from backend.models import StaffFollowUp, StaffAlert, StudentWeeklyTarget

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
    if not assigned_ids:
        return {
            "total_assigned": 0,
            "active_students": 0,
            "completed_students": 0,
            "pending_students": 0,
            "needing_attention": 0,
            "at_risk": 0,
            "workload_capacity": 30,
            "workload_status": "EMPTY",
            "weekly_progress_avg": 0,
            "overall_performance": "N/A"
        }

    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.stats)
    ).filter(Student.id.in_(assigned_ids)).all()

    total_assigned = len(students)
    active_count = 0
    at_risk_count = 0
    needing_attention_count = 0
    completed_count = 0
    pending_count = 0
    total_solved_sum = 0

    for s in students:
        perf = calculate_student_performance_status(s)
        if perf["status_code"] == "AT_RISK":
            at_risk_count += 1
            needing_attention_count += 1
        elif perf["status_code"] == "NEEDS_IMPROVEMENT":
            needing_attention_count += 1
        elif perf["status_code"] == "EXCELLENT":
            completed_count += 1
        else:
            pending_count += 1

        solved = s.stats.total_solved if (s.stats and s.stats.total_solved) else 0
        if solved > 0:
            active_count += 1
        total_solved_sum += solved

    avg_solved = round(total_solved_sum / total_assigned, 1) if total_assigned > 0 else 0.0
    pending_followups = db.query(StaffFollowUp).filter(
        StaffFollowUp.staff_id == current_user.id,
        StaffFollowUp.status == "PENDING"
    ).count()

    unread_alerts = db.query(StaffAlert).filter(
        StaffAlert.staff_id == current_user.id,
        StaffAlert.is_read == False
    ).count()

    # Calculate post-9:30 solvers count for assigned students
    from backend.routes.weekly_contests import get_post_930_solvers
    post_930_data = get_post_930_solvers(
        request=Depends(get_db), session_date=None, dept=None,
        year_level=None, section=None, min_post_window_solves=1,
        sort_by="latest", search=None, student_id=None, db=db
    ) if hasattr(db, 'query') else {"summary": {"students_detected": 0, "total_post_930_solves": 0}}

    post_930_summary = post_930_data.get("summary", {}) if isinstance(post_930_data, dict) else {}

    return {
        "faculty_id": current_user.id,
        "faculty_name": current_user.username,
        "total_assigned": total_assigned,
        "active_students": active_count,
        "completed_students": completed_count,
        "pending_students": pending_count,
        "needing_attention": needing_attention_count,
        "at_risk": at_risk_count,
        "pending_followups": pending_followups,
        "unread_alerts": unread_alerts,
        "post_930_solvers_count": post_930_summary.get("students_detected", 0),
        "post_930_total_solves": post_930_summary.get("total_post_930_solves", 0),
        "workload_capacity": 30,
        "workload_status": "NORMAL" if total_assigned <= 20 else ("FULL" if total_assigned == 30 else "ABOVE_TARGET"),
        "weekly_progress_avg": avg_solved,
        "overall_performance": "High" if at_risk_count == 0 else ("Moderate" if at_risk_count <= 3 else "Needs Action")
    }


@router.get("/priority-students")
def get_priority_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Returns assigned students requiring immediate attention."""
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
    if not assigned_ids:
        return []

    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(Student.id.in_(assigned_ids)).all()

    priority_list = []
    for s in students:
        perf = calculate_student_performance_status(s)
        if perf["status_code"] in ["AT_RISK", "NEEDS_IMPROVEMENT"] or perf["days_inactive"] >= 5:
            reasons = []
            if perf["days_inactive"] >= 5:
                reasons.append(f"Inactive for {perf['days_inactive']} days")
            if (s.stats.total_solved or 0) < 10:
                reasons.append("Low problem count")
            if perf["status_code"] == "AT_RISK":
                reasons.append("At Risk performance status")

            priority_list.append({
                "id": s.id,
                "name": s.name,
                "reg_no": s.reg_no,
                "department": s.department.code if s.department else "CSE",
                "year_level": s.year_level,
                "section": s.section.name if s.section else "A",
                "username": s.username,
                "total_solved": s.stats.total_solved if s.stats else 0,
                "days_inactive": perf["days_inactive"],
                "status_label": perf["status_label"],
                "status_code": perf["status_code"],
                "badge_color": perf["badge_color"],
                "trend": perf["trend_label"],
                "priority_reasons": reasons
            })

    priority_list.sort(key=lambda x: (x["status_code"] != "AT_RISK", -x["days_inactive"]))
    return priority_list


@router.get("/notes/{student_id}")
def get_student_notes(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Retrieves private mentoring notes for an assigned student."""
    from backend.models import MentorNote

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["staff", "faculty"]:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
        if student_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Access Denied: Student is not assigned to your portfolio.")

    notes = db.query(MentorNote).filter(MentorNote.student_id == student_id).order_by(MentorNote.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "student_id": n.student_id,
            "faculty_id": n.faculty_id,
            "faculty_name": n.faculty.username if n.faculty else "Staff",
            "note": n.note,
            "escalation_level": n.escalation_level,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notes
    ]


@router.post("/notes")
def create_student_note(
    payload: NoteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Adds a private mentoring note for an assigned student."""
    from backend.models import MentorNote

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["staff", "faculty"]:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
        if payload.student_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Access Denied: Student is not assigned to your portfolio.")

    new_note = MentorNote(
        student_id=payload.student_id,
        faculty_id=current_user.id,
        note=payload.note,
        escalation_level=payload.escalation_level or "NORMAL"
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    return {
        "success": True,
        "note": {
            "id": new_note.id,
            "student_id": new_note.student_id,
            "faculty_id": new_note.faculty_id,
            "faculty_name": current_user.username,
            "note": new_note.note,
            "escalation_level": new_note.escalation_level,
            "created_at": new_note.created_at.isoformat() if new_note.created_at else None
        }
    }


@router.get("/follow-ups")
def get_staff_follow_ups(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Retrieves follow-up tasks for the staff member."""
    from backend.models import StaffFollowUp, Student

    query = db.query(StaffFollowUp).options(joinedload(StaffFollowUp.student)).filter(
        StaffFollowUp.staff_id == current_user.id
    )
    if status_filter:
        query = query.filter(StaffFollowUp.status == status_filter.upper())

    follow_ups = query.order_by(StaffFollowUp.due_date.asc()).all()

    return [
        {
            "id": f.id,
            "student_id": f.student_id,
            "student_name": f.student.name if f.student else "Student",
            "reg_no": f.student.reg_no if f.student else "N/A",
            "title": f.title,
            "due_date": f.due_date,
            "status": f.status,
            "notes": f.notes,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "completed_at": f.completed_at.isoformat() if f.completed_at else None
        }
        for f in follow_ups
    ]


@router.post("/follow-ups")
def create_staff_follow_up(
    payload: FollowUpCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Schedules a new follow-up item for an assigned student."""
    from backend.models import StaffFollowUp

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["staff", "faculty"]:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
        if payload.student_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Access Denied: Student is not assigned to your portfolio.")

    follow_up = StaffFollowUp(
        student_id=payload.student_id,
        staff_id=current_user.id,
        title=payload.title,
        due_date=payload.due_date,
        status="PENDING",
        notes=payload.notes
    )
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)

    return {
        "success": True,
        "follow_up": {
            "id": follow_up.id,
            "student_id": follow_up.student_id,
            "title": follow_up.title,
            "due_date": follow_up.due_date,
            "status": follow_up.status
        }
    }


@router.put("/follow-ups/{follow_up_id}")
def update_staff_follow_up(
    follow_up_id: int,
    payload: FollowUpUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Updates status or notes of a follow-up item."""
    from backend.models import StaffFollowUp

    follow_up = db.query(StaffFollowUp).filter(
        StaffFollowUp.id == follow_up_id,
        StaffFollowUp.staff_id == current_user.id
    ).first()

    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up task not found.")

    follow_up.status = payload.status.upper()
    if payload.notes:
        follow_up.notes = payload.notes
    if payload.status.upper() == "COMPLETED":
        follow_up.completed_at = datetime.datetime.utcnow()

    db.commit()
    return {"success": True, "message": f"Follow-up status updated to {follow_up.status}."}


@router.get("/alerts")
def get_staff_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Returns alerts for assigned students."""
    from backend.models import StaffAlert

    alerts = db.query(StaffAlert).options(joinedload(StaffAlert.student)).filter(
        StaffAlert.staff_id == current_user.id
    ).order_by(StaffAlert.created_at.desc()).all()

    return [
        {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": a.student.name if a.student else "Student",
            "reg_no": a.student.reg_no if a.student else "N/A",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "is_read": a.is_read,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in alerts
    ]


@router.post("/alerts/mark-read")
def mark_alerts_as_read(
    alert_ids: List[int] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Marks specified alerts as read."""
    from backend.models import StaffAlert

    db.query(StaffAlert).filter(
        StaffAlert.id.in_(alert_ids),
        StaffAlert.staff_id == current_user.id
    ).update({"is_read": True}, synchronize_session=False)

    db.commit()
    return {"success": True, "marked_count": len(alert_ids)}


@router.get("/weekly-report")
def get_weekly_staff_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Generates automated weekly summary report for staff."""
    from backend.models import StaffFollowUp

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.stats)
    ).filter(Student.id.in_(assigned_ids)).all() if assigned_ids else []

    active_cnt = 0
    completed_cnt = 0
    needs_imp_cnt = 0
    at_risk_cnt = 0

    for s in students:
        perf = calculate_student_performance_status(s)
        if perf["status_code"] == "AT_RISK":
            at_risk_cnt += 1
        elif perf["status_code"] == "NEEDS_IMPROVEMENT":
            needs_imp_cnt += 1
        elif perf["status_code"] == "EXCELLENT":
            completed_cnt += 1
        else:
            active_cnt += 1

    pending_followups = db.query(StaffFollowUp).filter(
        StaffFollowUp.staff_id == current_user.id,
        StaffFollowUp.status == "PENDING"
    ).count()

    return {
        "staff_name": current_user.username,
        "assigned_students": len(students),
        "active": active_cnt,
        "completed": completed_cnt,
        "needs_improvement": needs_imp_cnt,
        "at_risk": at_risk_cnt,
        "follow_ups": pending_followups,
        "report_date": datetime.datetime.utcnow().strftime("%Y-%m-%d")
    }

