"""
faculty_assignments.py — API Routes for Faculty-Student Allocation & Workload Tracking

Provides endpoints for managing 1:20 faculty-to-student assignments, workload distribution,
and faculty-scoped student lists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import User, Student, FacultyStudentAssignment
from backend.security import require_role
from backend.routes.auth import assert_not_protected_super_admin
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from backend.services.authorization_service import _STAFF_ROLES
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
    student_ids: Optional[List[int]] = None


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
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore

    if not assigned_ids:
        return {
            "faculty_id": int(current_user.id),  # type: ignore
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

    from backend.models import StudentStatSnapshot
    import datetime
    
    # Calculate weekly progress dynamically using StudentStatSnapshot (delta from 7 days ago)
    weekly_prog_map = {}
    if assigned_ids:
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            t_7d = now_utc - datetime.timedelta(days=7)
            snapshots = db.query(StudentStatSnapshot).filter(
                StudentStatSnapshot.student_id.in_(assigned_ids)
            ).order_by(StudentStatSnapshot.student_id, StudentStatSnapshot.captured_at.asc()).all()
            
            snap_map = {}
            for snap in snapshots:
                cap = snap.captured_at
                if cap:
                    if isinstance(cap, str):
                        try:
                            import dateutil.parser
                            cap = dateutil.parser.parse(cap)
                        except Exception:
                            cap = None
                    if cap:
                        if getattr(cap, "tzinfo", None) is None:
                            cap = cap.replace(tzinfo=datetime.timezone.utc)
                        if cap <= t_7d:
                            snap_map[snap.student_id] = snap
                        elif snap.student_id not in snap_map:
                            snap_map[snap.student_id] = snap
                        
            for s in students:
                snap = snap_map.get(s.id)
                if snap and s.stats and s.stats.total_solved is not None:
                    weekly_prog_map[s.id] = max(0, int(s.stats.total_solved or 0) - int(snap.total_solved or 0))
                else:
                    weekly_prog_map[s.id] = 0
        except Exception as snap_err:
            logger.warning(f"[WEEKLY_PROG_CALC_WARN] {snap_err}")

    # Fetch latest finalized Weekly Contest results (e.g. Weekly Contest 523, Session 14)
    contest_score_map = {}
    try:
        from backend.models import WeeklySession, WeeklyPublicResult
        latest_weekly = db.query(WeeklySession).filter(
            WeeklySession.contest_name.ilike("Weekly Contest%"),
            WeeklySession.status == "FINALIZED"
        ).order_by(WeeklySession.id.desc()).first()

        if latest_weekly and assigned_ids:
            pub_results = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == latest_weekly.id,
                WeeklyPublicResult.student_id.in_(assigned_ids)
            ).all()
            for pr in pub_results:
                is_att = pr.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")
                if is_att:
                    sol = pr.total_contest_solved if pr.total_contest_solved is not None else ((pr.q1 or 0) + (pr.q2 or 0) + (pr.q3 or 0) + (pr.q4 or 0))
                    contest_score_map[pr.student_id] = f"{sol} / 4"
                else:
                    contest_score_map[pr.student_id] = "0 / 4"
    except Exception as c_err:
        logger.warning(f"[CONTEST_SCORE_MAP_WARN] {c_err}")

    student_list = []
    for s in students:
        week_solved = weekly_prog_map.get(s.id, 0)
        perf = calculate_student_performance_status(s, weekly_solved=week_solved)

        # Determine recent contest score: priority session result > profile stats
        c_score = contest_score_map.get(s.id)
        if not c_score and s.stats and getattr(s.stats, "recent_contest_score", None):
            c_score = s.stats.recent_contest_score
        if not c_score:
            c_score = "0 / 4" if (s.username and str(s.username).strip()) else None

        st_out = {
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "CSE",
            "year_level": s.year_level,
            "section": s.section.name if s.section else "A",
            "username": s.username,
            "leetcode_url": s.leetcode_url,
            "total_solved": s.stats.total_solved if (s.stats and s.stats.total_solved is not None) else 0,
            "weekly_solved": week_solved,
            "easy_solved": s.stats.easy_solved if (s.stats and s.stats.easy_solved is not None) else 0,
            "medium_solved": s.stats.medium_solved if (s.stats and s.stats.medium_solved is not None) else 0,
            "hard_solved": s.stats.hard_solved if (s.stats and s.stats.hard_solved is not None) else 0,
            "contest_rating": s.stats.contest_rating if (s.stats and s.stats.contest_rating is not None) else 0.0,
            "max_streak": s.stats.max_streak if (s.stats and s.stats.max_streak is not None) else 0,
            "sync_status": s.stats.sync_status if s.stats else "not_started",
            "recent_contest_score": c_score,
            "status_code": perf["status_code"],
            "status_label": perf["status_label"],
            "badge_color": perf["badge_color"],
            "days_inactive": perf["days_inactive"],
            "trend": perf["trend"],
            "trend_label": perf["trend_label"]
        }
        student_list.append(st_out)

    count = len(student_list)
    workload_status = "WITHIN CAPACITY" if count < 30 else ("AT CAPACITY" if count == 30 else "OVER CAPACITY")

    return {
        "faculty_id": int(current_user.id),  # type: ignore
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

    # HOD & Placement Coordinator authorization check
    user_role = (current_user.role or "").strip().lower()
    is_placement_coord = any(p in user_role for p in ["placement", "placement coordinator", "placement_coordinator", "placement officer", "placement_officer"])
    is_admin_user = user_role in ["admin", "super admin", "super_admin", "administrator", "principal", "management", "director"] or is_placement_coord
    if not is_admin_user and "hod" in user_role:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if faculty.department_id and auth_dept_ids and faculty.department_id not in auth_dept_ids:
            raise HTTPException(
                status_code=403,
                detail="Access restricted: You can only view faculty within your authorized department(s)."
            )

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, faculty_id)
    students = db.query(Student).filter(Student.id.in_(assigned_ids)).all() if assigned_ids else []

    total_assigned = len(students)
    return {
        "faculty_id": int(faculty.id),  # type: ignore
        "faculty_name": faculty.full_name or faculty.username,
        "username": faculty.username,
        "full_name": faculty.full_name or faculty.username,
        "department_id": faculty.department_id,
        "total_assigned": total_assigned,
        "max_allowed": 20,
        "slots_remaining": max(0, 20 - total_assigned),
        "is_allocated": total_assigned > 0,
        "allocation_status": "ALLOCATED" if total_assigned > 0 else "UNALLOCATED",
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
    background_tasks: BackgroundTasks,
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
    is_placement_coord = any(p in user_role for p in ["placement", "placement coordinator", "placement_coordinator", "placement officer", "placement_officer"])
    is_admin_user = user_role in ["admin", "super admin", "super_admin", "administrator", "principal", "management", "director"] or is_placement_coord
    if not is_admin_user and "hod" in user_role:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if faculty.department_id and auth_dept_ids and faculty.department_id not in auth_dept_ids:
            raise HTTPException(
                status_code=403,
                detail="Access restricted: HOD can only assign students to faculty in their authorized department(s)."
            )

    return faculty_assignment_service.assign_students_to_faculty(
        db=db,
        faculty_id=payload.faculty_id,
        student_ids=payload.student_ids,
        assigned_by_id=int(current_user.id),  # type: ignore
        background_tasks=background_tasks
    )


@router.post("/unassign")
def unassign_students(
    payload: UnassignStudentsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """Removes student assignments from a faculty member."""
    try:
        return faculty_assignment_service.unassign_students(
            db=db,
            faculty_id=payload.faculty_id,
            student_ids=payload.student_ids,
            background_tasks=background_tasks
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unassign Error: {str(e)}")


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

    assert_not_protected_super_admin(faculty, "deleted or deactivated")

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only delete staff members in their own department."
        )

    # Safely return assigned students to the queue by removing the assignment mapping
    deleted_assignments = db.query(FacultyStudentAssignment).filter(
        FacultyStudentAssignment.faculty_id == faculty_id
    ).delete(synchronize_session=False)

    # Soft-delete the faculty user record to preserve historical mentor notes and audits
    faculty_name = faculty.username
    faculty.is_active = False  # type: ignore
    db.commit()

    return {
        "success": True,
        "message": f"Staff member '{faculty_name}' deleted successfully.",
        "unassigned_count": deleted_assignments
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
        student_ids=payload.student_ids,
        assigned_by_id=int(current_user.id)  # type: ignore
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
    is_placement_coord = any(p in user_role for p in ["placement", "placement coordinator", "placement_coordinator", "placement officer", "placement_officer"])
    is_admin_user = user_role in ["admin", "super admin", "super_admin", "administrator", "principal", "management", "director"] or is_placement_coord
    
    target_dept_id = dept_id
    if not is_admin_user and "hod" in user_role:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if auth_dept_ids:
            if dept_id and dept_id in auth_dept_ids:
                target_dept_id = dept_id
            else:
                target_dept_id = auth_dept_ids[0] if len(auth_dept_ids) == 1 else None
        elif current_user.department_id:
            target_dept_id = current_user.department_id

    assigned_faculty_subq = db.query(FacultyStudentAssignment.faculty_id).filter(
        FacultyStudentAssignment.is_active == True
    ).distinct()

    query = db.query(User).options(joinedload(User.department)).filter(
        User.is_active == True,
        or_(
            User.role.in_([
                "Faculty", "faculty", "Staff", "staff", "HOD", "hod",
                "Placement Coordinator", "placement coordinator", "placement_coordinator",
                "Coordinator", "coordinator", "Academic Coordinator", "academic coordinator",
                "Staff Mentor", "staff mentor", "Faculty Mentor", "faculty mentor", "Professor", "professor"
            ]),
            User.role.ilike("%Placement%"),
            User.role.ilike("%Coordinator%"),
            User.id.in_(assigned_faculty_subq)
        ),
        ~func.lower(User.role).in_(["admin", "super admin", "super_admin", "administrator", "student"]),
        ~User.username.ilike("test_%"),
        ~User.username.ilike("dummy_%"),
        ~User.username.ilike("sec_test_%"),
        ~User.username.ilike("hardening_%")
    )
    if target_dept_id:
        query = query.filter(
            or_(
                User.department_id == target_dept_id,
                User.id.in_(
                    db.query(FacultyStudentAssignment.faculty_id).join(
                        Student, FacultyStudentAssignment.student_id == Student.id
                    ).filter(
                        FacultyStudentAssignment.is_active == True,
                        Student.department_id == target_dept_id
                    )
                )
            )
        )

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
        count = assigned_counts.get(int(fac.id), 0)  # type: ignore
        status_code = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))
        status_label = "Normal" if count < 20 else ("At Ratio" if count == 20 else ("Above Ratio" if count <= 30 else "High Workload"))
        workload.append({
            "faculty_id": int(fac.id),  # type: ignore
            "faculty_name": fac.full_name or fac.username,
            "username": fac.username,
            "full_name": fac.full_name or fac.username,
            "email": fac.email,
            "role": fac.role,
            "department_id": fac.department_id,
            "department_name": fac.department.name if fac.department else "General",
            "department_code": fac.department.code if fac.department else "GEN",
            "assigned_students": count,
            "recommended_ratio": 20,
            "max_capacity": 20,
            "is_allocated": bool(count > 0),
            "allocation_status": "ALLOCATED" if count > 0 else "UNALLOCATED",
            "workload_status": status_code,
            "workload_label": status_label,
            "is_above_ratio": count > 20
        })

    return {
        "total_faculty": len(faculty_list),
        "target_department_id": target_dept_id,
        "recommended_ratio_per_faculty": 20,
        "max_capacity_per_faculty": 20,
        "faculty_workload": workload
    }


# =========================================================================
# STAFF MENTORING & MONITORING ENDPOINTS
# =========================================================================


def calculate_student_performance_status(s: Student, weekly_solved: int = 0) -> Dict[str, Any]:
    """Helper to automatically classify student status & trend based on weekly performance."""
    total = s.stats.total_solved if (s.stats and s.stats.total_solved is not None) else 0
    streak = s.stats.max_streak if (s.stats and s.stats.max_streak is not None) else 0
    rating = s.stats.contest_rating if (s.stats and s.stats.contest_rating is not None) else 0.0
    last_verified = s.stats.last_verified_at if s.stats else None

    days_inactive = 0
    if last_verified:
        try:
            now = datetime.datetime.now(datetime.timezone.utc)
            if isinstance(last_verified, str):
                try:
                    import dateutil.parser
                    last_verified = dateutil.parser.parse(last_verified)
                except Exception:
                    last_verified = datetime.datetime.fromisoformat(last_verified.replace("Z", "+00:00"))
            if getattr(last_verified, "tzinfo", None) is None:
                last_verified = last_verified.replace(tzinfo=datetime.timezone.utc)
            days_inactive = max(0, (now - last_verified).days)
        except Exception:
            days_inactive = 0

    if days_inactive >= 8 or total == 0 or not s.username:
        status_label = "At Risk"
        status_code = "AT_RISK"
        badge_color = "red"
    elif weekly_solved == 0:
        status_label = "Needs Attention"
        status_code = "ATTENTION"
        badge_color = "amber"
    elif weekly_solved > 0:
        status_label = "Completed"
        status_code = "COMPLETED"
        badge_color = "emerald"
    else:
        status_label = "Improving"
        status_code = "IMPROVING"
        badge_color = "blue"

    # Performance trend calculation based on recent records
    trend = "STABLE"
    trend_label = " Stable"

    if total > 50 and days_inactive <= 2:
        trend = "IMPROVING"
        trend_label = " Improving"
    elif days_inactive >= 7:
        trend = "DECLINING"
        trend_label = " Declining"

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
    from backend.models import StaffFollowUp, StaffAlert

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
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
    total_capped_solved_sum = 0

    for s in students:
        perf = calculate_student_performance_status(s)
        if perf["status_code"] == "AT_RISK":
            at_risk_count += 1
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
        total_capped_solved_sum += min(solved, 100)

    avg_solved = round(total_solved_sum / total_assigned, 1) if total_assigned > 0 else 0.0
    target_progress_pct = round((total_capped_solved_sum / (total_assigned * 100)) * 100, 1) if total_assigned > 0 else 0.0
    pending_followups = db.query(StaffFollowUp).filter(
        StaffFollowUp.staff_id == int(current_user.id),  # type: ignore
        StaffFollowUp.status == "PENDING"
    ).count()

    unread_alerts = db.query(StaffAlert).filter(
        StaffAlert.staff_id == int(current_user.id),  # type: ignore
        StaffAlert.is_read == False
    ).count()

    # Calculate post-9:30 solvers count for assigned students
    post_930_summary = {"students_detected": 0, "total_post_930_solves": 0}
    try:
        from backend.routes.weekly_contests import get_post_930_solvers
        post_930_data = get_post_930_solvers(  # type: ignore
            session_date=None, dept=None,
            year_level=None, section=None, min_post_window_solves=1,
            sort_by="latest", search=None, student_id=None, db=db
        )
        if isinstance(post_930_data, dict):
            post_930_summary = post_930_data.get("summary", post_930_summary)
    except Exception:
        pass

    return {
        "faculty_id": int(current_user.id),  # type: ignore
        "faculty_name": current_user.username,
        "total_assigned": total_assigned,
        "active_students": active_count,
        "completed_students": completed_count,
        "pending_students": pending_count,
        "needing_attention": needing_attention_count,
        "at_risk": at_risk_count,
        "pending_followups": pending_followups,
        "unread_alerts": unread_alerts,
        "post_930_solvers_count": post_930_summary.get("students_detected", 0),  # type: ignore
        "post_930_total_solves": post_930_summary.get("total_post_930_solves", 0),  # type: ignore
        "workload_capacity": 30,
        "workload_status": "WITHIN CAPACITY" if total_assigned < 30 else ("AT CAPACITY" if total_assigned == 30 else "OVER CAPACITY"),
        "weekly_progress_avg": avg_solved,
        "target_progress_pct": target_progress_pct,
        "target_benchmark": 100,
        "overall_performance": "High" if at_risk_count == 0 else ("Moderate" if at_risk_count <= 3 else "Needs Action")
    }


@router.get("/priority-students")
def get_priority_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Returns assigned students requiring immediate attention."""
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
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
        days_inact = int(perf.get("days_inactive") or 0)
        total_solved = int(s.stats.total_solved or 0) if (s.stats and s.stats.total_solved is not None) else 0

        if perf.get("status_code") in ["AT_RISK", "NEEDS_IMPROVEMENT"] or days_inact >= 5:
            reasons = []
            if days_inact >= 5:
                reasons.append(f"Inactive for {days_inact} days")
            if total_solved < 10:
                reasons.append("Low problem count")
            if perf.get("status_code") == "AT_RISK":
                reasons.append("At Risk performance status")

            priority_list.append({
                "id": s.id,
                "name": s.name,
                "reg_no": s.reg_no,
                "department": s.department.code if s.department else "CSE",
                "year_level": s.year_level,
                "section": s.section.name if s.section else "A",
                "username": s.username,
                "total_solved": total_solved,
                "days_inactive": days_inact,
                "status_label": perf.get("status_label") or "At Risk",
                "status_code": perf.get("status_code") or "AT_RISK",
                "badge_color": perf.get("badge_color") or "red",
                "trend": perf.get("trend_label") or "Neutral",
                "priority_reasons": reasons
            })

    priority_list.sort(key=lambda x: (x.get("status_code") != "AT_RISK", -int(x.get("days_inactive") or 0)))
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
    if user_role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
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
    if user_role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
        if payload.student_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Access Denied: Student is not assigned to your portfolio.")

    new_note = MentorNote(
        student_id=payload.student_id,
        faculty_id=int(current_user.id),
        note=payload.note,
        escalation_level=payload.escalation_level or "NORMAL"
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    # If note is escalated, notify HOD & Admin immediately
    if (payload.escalation_level or "").upper() in ("HIGH", "CRITICAL", "ESCALATED", "URGENT"):
        try:
            from backend.services.notification_service import NotificationService
            st = db.query(Student).filter(Student.id == payload.student_id).first()
            st_name = st.name if st else "Student"
            staff_name = getattr(current_user, "full_name", None) or current_user.username or "Faculty"
            NotificationService.emit_event(
                event_type="URGENT_ANNOUNCEMENT",
                title=f"Student Escalation: {st_name}",
                body=f"Dear HOD/Admin, Faculty {staff_name} escalated a case for student {st_name} ({payload.escalation_level}): \"{payload.note[:70]}\"",
                actor_user_id=f"STAFF_{current_user.id}",
                recipient_scope="ROLE",
                recipient_target="HOD",
                route="/faculty/action-center",
                priority="high",
                metadata={"student_id": payload.student_id, "note_id": new_note.id, "escalated_by": staff_name}
            )
        except Exception as notif_err:
            logger.warning(f"[NOTE_ESCALATION_NOTIF] Failed: {notif_err}")

    return {
        "success": True,
        "note": {
            "id": new_note.id,
            "student_id": new_note.student_id,
            "faculty_id": int(new_note.faculty_id),  # type: ignore
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
    from backend.models import StaffFollowUp

    query = db.query(StaffFollowUp).options(joinedload(StaffFollowUp.student)).filter(
        StaffFollowUp.staff_id == int(current_user.id)  # type: ignore
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
    if user_role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
        if payload.student_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Access Denied: Student is not assigned to your portfolio.")

    follow_up = StaffFollowUp(
        student_id=payload.student_id,
        staff_id=int(current_user.id),
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
        StaffFollowUp.staff_id == int(current_user.id)  # type: ignore
    ).first()

    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up task not found.")

    follow_up.status = payload.status.upper()  # type: ignore
    if payload.notes:
        follow_up.notes = payload.notes  # type: ignore
    if payload.status.upper() == "COMPLETED":
        follow_up.completed_at = datetime.datetime.now(datetime.timezone.utc)  # type: ignore

    db.commit()

    if payload.status.upper() == "COMPLETED":
        try:
            from backend.services.notification_service import NotificationService
            st = db.query(Student).filter(Student.id == follow_up.student_id).first()
            st_name = st.name if st else "Student"
            staff_name = getattr(current_user, "full_name", None) or current_user.username or "Faculty"
            NotificationService.emit_event(
                event_type="ASSIGNMENT_COMPLETED",
                title=f"Task Completed: {follow_up.title}",
                body=f"Dear HOD/Admin, Faculty {staff_name} marked follow-up task '{follow_up.title}' as COMPLETED today for {st_name}.",
                actor_user_id=f"STAFF_{current_user.id}",
                recipient_scope="ROLE",
                recipient_target="HOD",
                route="/faculty/action-center",
                priority="high",
                metadata={"follow_up_id": follow_up_id, "student_id": follow_up.student_id, "status": "COMPLETED", "resolved_by": staff_name}
            )
        except Exception as notif_err:
            logger.warning(f"[FOLLOW_UP_COMPLETED_NOTIF] Failed: {notif_err}")

    return {"success": True, "message": f"Follow-up status updated to {follow_up.status}."}


@router.get("/alerts")
def get_staff_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """Returns alerts for assigned students."""
    from backend.models import StaffAlert

    alerts = db.query(StaffAlert).options(joinedload(StaffAlert.student)).filter(
        StaffAlert.staff_id == int(current_user.id)  # type: ignore
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
        StaffAlert.staff_id == int(current_user.id)  # type: ignore
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

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(current_user.id))  # type: ignore
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
        StaffFollowUp.staff_id == int(current_user.id),  # type: ignore
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
        "report_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    }


# In-memory concurrency locks to prevent duplicate live-sync operations
_faculty_sync_locks: Dict[int, bool] = {}

@router.post("/live-sync")
async def faculty_live_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """
    Executes a production live LeetCode data sync STRICTLY scoped to the authenticated
    staff member's assigned portfolio.
    Guarantees:
    - Never trusts client-supplied student IDs.
    - Concurrency lock prevents duplicate sync jobs.
    - Uses existing live LeetCode sync engine with concurrency control.
    - Transactionally writes live updates to PostgreSQL / SQLite.
    - Logs audit record in faculty_action_audit_logs.
    """
    faculty_id = int(current_user.id)  # type: ignore
    if _faculty_sync_locks.get(faculty_id, False):
        return {
            "status": "ALREADY_RUNNING",
            "message": "Live sync is already running for your assigned portfolio. Please wait for it to complete.",
            "faculty_id": faculty_id
        }

    _faculty_sync_locks[faculty_id] = True
    try:
        # Resolve authoritative assigned students from database
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, faculty_id)
        if not assigned_ids:
            return {
                "status": "COMPLETED",
                "message": "No students currently assigned to your portfolio.",
                "total_assigned": 0,
                "success_count": 0,
                "unavailable_count": 0,
                "failed_count": 0,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }

        from backend.sync_engine import sync_single_student_by_id
        
        success_count = 0
        unavailable_count = 0
        failed_count = 0
        results = []

        for st_id in assigned_ids:
            try:
                res = await sync_single_student_by_id(st_id, timeout=20.0)
                st_status = res.get("status")
                if st_status == "success":
                    success_count += 1
                elif "NOT FOUND" in str(res.get("error", "")).upper() or "INVALID" in str(res.get("error", "")).upper():
                    unavailable_count += 1
                else:
                    failed_count += 1
                results.append({
                    "student_id": st_id,
                    "status": st_status,
                    "name": res.get("name")
                })
            except Exception as e:
                failed_count += 1
                results.append({
                    "student_id": st_id,
                    "status": "failed",
                    "error": str(e)
                })

        # Record Audit Log
        from backend.models import AuditLog
        try:
            audit = AuditLog(
                user_id=faculty_id,
                user_name=current_user.username,
                action="LIVE_SYNC_PORTFOLIO",
                details=f"Live sync completed for {len(assigned_ids)} students: {success_count} success, {unavailable_count} unavailable, {failed_count} failed."
            )
            db.add(audit)
            db.commit()
        except Exception as a_err:
            logger.warning(f"Failed to record live-sync audit log: {a_err}")

        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return {
            "status": "COMPLETED",
            "message": f"Live sync completed: {success_count} profiles updated, {unavailable_count} unavailable, {failed_count} failed.",
            "faculty_id": faculty_id,
            "faculty_name": current_user.username,
            "total_assigned": len(assigned_ids),
            "success_count": success_count,
            "unavailable_count": unavailable_count,
            "failed_count": failed_count,
            "timestamp": now_utc,
            "results": results
        }
    finally:
        _faculty_sync_locks[faculty_id] = False


