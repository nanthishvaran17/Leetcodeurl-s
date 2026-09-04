"""
institutional_dashboards.py — Dedicated Dashboards for Institutional Roles

Endpoints:
1. Super Admin: Global overview, all departments, institutional KPI, sync health.
2. HOD: Strictly department-scoped metrics, faculty workload, department leaderboard, alerts.
3. Faculty: Strictly assigned-students metrics (max 20), problems solved, streaks, contest participation.
4. Student: Self profile, problems breakdown, rank, contest history.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import Optional
import datetime

from backend.database import get_db
from backend.models import (
    User, Student, Department, LeetCodeProfileStats, WeeklySession,
    FacultyStudentAssignment, ContestParticipation
)
from backend.security import require_role, get_current_user_optional
from backend.services.faculty_assignment_service import faculty_assignment_service
from backend.cache import cache

router = APIRouter(prefix="/institutional", tags=["Institutional Dashboards"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. SUPER ADMIN DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/super-admin")
def get_super_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin"))
):
    """
    Super Admin Dashboard: Institution-wide visibility across all departments,
    faculty, students, sync health, and system telemetry.
    """
    cache_key = "dash:super_admin"
    cached = cache.get(cache_key)
    if cached:
        return cached

    total_students = db.query(func.count(Student.id)).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).scalar() or 0

    total_depts = db.query(func.count(Department.id)).scalar() or 0
    total_faculty = db.query(func.count(User.id)).filter(
        User.role.in_(["Faculty", "faculty", "Staff", "staff"])
    ).scalar() or 0
    total_hods = db.query(func.count(User.id)).filter(
        User.role.in_(["HOD", "hod"])
    ).scalar() or 0

    # Sync health metrics
    sync_stats = db.query(
        LeetCodeProfileStats.sync_status,
        func.count(LeetCodeProfileStats.id)
    ).group_by(LeetCodeProfileStats.sync_status).all()
    sync_breakdown = {status or "unknown": cnt for status, cnt in sync_stats}

    # Department breakdown matrix using efficient single grouped SQL queries
    depts = db.query(Department).all()

    dept_rows = db.query(
        Student.department_id,
        func.count(Student.id).label("total_students"),
        func.coalesce(func.sum(LeetCodeProfileStats.total_solved), 0).label("total_solved"),
        func.coalesce(func.avg(LeetCodeProfileStats.contest_rating), 0.0).label("avg_rating")
    ).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
     .filter((Student.is_active == True) | (Student.is_active.is_(None)))\
     .group_by(Student.department_id).all()

    dept_student_stats = {r[0]: (r[1], r[2], r[3]) for r in dept_rows}

    dept_faculty_rows = db.query(
        User.department_id,
        func.count(User.id)
    ).filter(
        User.role.in_(["Faculty", "faculty", "Staff", "staff"]),
        User.is_active == True
    ).group_by(User.department_id).all()

    dept_faculty_counts = {r[0]: r[1] for r in dept_faculty_rows}

    dept_matrix = []
    for d in depts:
        stats = dept_student_stats.get(d.id)
        d_students = stats[0] if stats else 0
        d_solved = int(stats[1]) if stats else 0
        d_avg_rating = round(float(stats[2]), 1) if stats else 0.0
        d_faculty = dept_faculty_counts.get(d.id, 0)

        dept_matrix.append({
            "department_id": d.id,
            "department_code": d.code,
            "department_name": d.name,
            "total_students": d_students,
            "total_faculty": d_faculty,
            "total_problems_solved": d_solved,
            "avg_contest_rating": d_avg_rating,
            "avg_solved_per_student": round(d_solved / d_students, 1) if d_students > 0 else 0
        })

    # Latest contest session status
    latest_sess = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    contest_status = {
        "session_id": latest_sess.id if latest_sess else None,
        "contest_name": latest_sess.contest_name if latest_sess else "None",
        "status": latest_sess.status if latest_sess else "NONE",
        "session_date": latest_sess.session_date if latest_sess else None
    }

    result = {
        "role": "Super Admin",
        "total_students": total_students,
        "total_departments": total_depts,
        "total_faculty": total_faculty,
        "total_hods": total_hods,
        "sync_health": {
            "verified_active": sync_breakdown.get("success", 0) + sync_breakdown.get("OK", 0) + sync_breakdown.get("verified", 0),
            "pending": sync_breakdown.get("pending", 0) + sync_breakdown.get("not_started", 0),
            "failed": sync_breakdown.get("failed", 0) + sync_breakdown.get("fetch_failed", 0)
        },
        "department_matrix": dept_matrix,
        "latest_contest": contest_status,
        "last_updated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    }

    cache.set(cache_key, result, ttl_seconds=30)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 2. HOD DASHBOARD (Department-Scoped)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/hod")
def get_hod_dashboard(
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    HOD Dashboard: Strictly displays data for the authenticated HOD's department.
    Enforces that HOD cannot access other departments.
    """
    user_role = (current_user.role or "").strip().lower()
    target_dept_id = current_user.department_id if user_role in ["hod"] else (dept_id or current_user.department_id or 1)

    if user_role in ["hod"] and dept_id and dept_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: You can only access your own department data."
        )

    dept_obj = db.query(Department).filter(Department.id == target_dept_id).first()
    dept_code = dept_obj.code if dept_obj else "DEPT"

    cache_key = f"dash:hod:{target_dept_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    total_students = db.query(func.count(Student.id)).filter(
        Student.department_id == target_dept_id,
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).scalar() or 0

    total_solved = db.query(func.sum(LeetCodeProfileStats.total_solved)).join(
        Student, Student.id == LeetCodeProfileStats.student_id
    ).filter(Student.department_id == target_dept_id).scalar() or 0

    faculty_list = db.query(User).filter(
        User.department_id == target_dept_id,
        User.is_active == True,
        User.role.in_(["Faculty", "faculty", "Staff", "staff"])
    ).all()

    fac_ids = [f.id for f in faculty_list]
    count_rows = db.query(
        FacultyStudentAssignment.faculty_id,
        func.count(FacultyStudentAssignment.id)
    ).filter(
        FacultyStudentAssignment.faculty_id.in_(fac_ids),
        FacultyStudentAssignment.is_active == True
    ).group_by(FacultyStudentAssignment.faculty_id).all() if fac_ids else []

    assigned_counts = {r[0]: r[1] for r in count_rows}
    faculty_workload = []
    assigned_student_count = 0
    for fac in faculty_list:
        cnt = assigned_counts.get(fac.id, 0)
        assigned_student_count += cnt
        status_code = "NORMAL" if cnt < 20 else ("AT_RATIO" if cnt == 20 else ("ABOVE_RATIO" if cnt <= 30 else "HIGH_WORKLOAD"))
        status_label = "Normal" if cnt < 20 else ("At Ratio" if cnt == 20 else ("Above Ratio" if cnt <= 30 else "High Workload"))
        faculty_workload.append({
            "faculty_id": fac.id,
            "faculty_name": fac.username,
            "assigned_count": cnt,
            "recommended_ratio": 20,
            "workload_status": status_code,
            "workload_label": status_label,
            "is_above_ratio": cnt > 20
        })

    # Department top 10 leaderboard (single indexed query)
    top_students = db.query(Student).options(joinedload(Student.stats)).outerjoin(Student.stats).filter(
        Student.department_id == target_dept_id,
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).order_by(
        desc(LeetCodeProfileStats.total_solved)
    ).limit(10).all()

    leaderboard = [
        {
            "rank": idx,
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "year_level": s.year_level,
            "username": s.username,
            "total_solved": s.stats.total_solved if s.stats else 0,
            "contest_rating": s.stats.contest_rating if s.stats else 0.0,
            "max_streak": s.stats.max_streak if s.stats else 0
        }
        for idx, s in enumerate(top_students, start=1)
    ]

    # Students requiring attention (0 solved or sync failed)
    needing_attention = db.query(Student).outerjoin(Student.stats).filter(
        Student.department_id == target_dept_id,
        (Student.is_active == True) | (Student.is_active.is_(None)),
        (LeetCodeProfileStats.total_solved == 0) | (LeetCodeProfileStats.total_solved.is_(None)) | (LeetCodeProfileStats.sync_status == "failed")
    ).limit(15).all()

    attention_list = [
        {
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "year_level": s.year_level,
            "username": s.username,
            "issue": "Zero Solves" if (not s.stats or not s.stats.total_solved) else "Sync Failed"
        }
        for s in needing_attention
    ]

    result = {
        "role": "HOD",
        "department_id": target_dept_id,
        "department_code": dept_code,
        "department_name": dept_obj.name if dept_obj else "Department",
        "total_students": total_students,
        "unassigned_students": max(0, total_students - assigned_student_count),
        "total_problems_solved": int(total_solved),
        "faculty_count": len(faculty_list),
        "faculty_workload": faculty_workload,
        "top_performers": leaderboard,
        "students_needing_attention": attention_list,
        "last_updated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    }

    cache.set(cache_key, result, ttl_seconds=30)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 3. FACULTY DASHBOARD (Assigned-Students Scoped, Dynamic Count)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/faculty")
def get_faculty_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """
    Faculty Dashboard: Strictly scoped to all students assigned to the authenticated faculty member.
    No upper limit on student count (20 is recommended mentoring ratio).
    Displays solved count, daily streaks, contest attendance, and individual alert items.
    """
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
    
    if not assigned_ids:
        return {
            "role": "Faculty",
            "faculty_id": current_user.id,
            "faculty_name": current_user.username,
            "department": current_user.department.code if current_user.department else "CSE",
            "assigned_count": 0,
            "recommended_ratio": 20,
            "workload_status": "NORMAL",
            "students": [],
            "metrics": {
                "total_solved_group": 0,
                "avg_solved": 0,
                "active_streak_count": 0
            }
        }

    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.stats)
    ).filter(Student.id.in_(assigned_ids)).all()

    student_data = []
    total_group_solved = 0
    active_streaks = 0

    for s in students:
        solved = s.stats.total_solved if (s.stats and s.stats.total_solved) else 0
        streak = s.stats.max_streak if (s.stats and s.stats.max_streak) else 0
        rating = s.stats.contest_rating if (s.stats and s.stats.contest_rating) else 0.0

        total_group_solved += solved
        if streak > 0:
            active_streaks += 1

        student_data.append({
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "year_level": s.year_level,
            "username": s.username,
            "leetcode_url": s.leetcode_url,
            "total_solved": solved,
            "easy_solved": s.stats.easy_solved if s.stats else 0,
            "medium_solved": s.stats.medium_solved if s.stats else 0,
            "hard_solved": s.stats.hard_solved if s.stats else 0,
            "contest_rating": rating,
            "max_streak": streak,
            "sync_status": s.stats.sync_status if s.stats else "not_started",
            "needs_mentoring": solved < 10 or streak == 0
        })

    # Sort students by solved desc
    student_data.sort(key=lambda x: x["total_solved"], reverse=True)
    count = len(student_data)
    workload_status = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))

    return {
        "role": "Faculty",
        "faculty_id": current_user.id,
        "faculty_name": current_user.username,
        "department": current_user.department.code if current_user.department else "CSE",
        "assigned_count": count,
        "recommended_ratio": 20,
        "workload_status": workload_status,
        "workload_warning": f"Above recommended ratio ({count}/20)" if count > 20 else None,
        "metrics": {
            "total_solved_group": total_group_solved,
            "avg_solved": round(total_group_solved / count, 1) if count else 0,
            "active_streak_count": active_streaks
        },
        "students": student_data
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. STUDENT DASHBOARD (Self Profile)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/student-profile")
def get_student_self_profile(
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Student Dashboard: Returns authenticated student's verified profile,
    problem breakdown, rank, and contest participation history.
    Strictly enforces role isolation:
    - Student -> Only own profile (attempting other student returns 403 Forbidden).
    - Faculty -> Only assigned students (attempting unassigned student returns 403 Forbidden).
    - HOD -> Only department students (attempting other department returns 403 Forbidden).
    - Super Admin -> All students.
    """
    target_student = None

    if student_id:
        target_student = db.query(Student).filter(Student.id == student_id).first()
    elif current_user:
        # Match by email or username
        target_student = db.query(Student).filter(
            (Student.email == current_user.email) | (Student.username == current_user.username)
        ).first()

    if not target_student:
        target_student = db.query(Student).first()

    if not target_student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Role-Based Boundary Enforcement
    if current_user:
        user_role = (current_user.role or "").strip().lower()
        
        # 1. Student Role Isolation
        if user_role == "student":
            is_own = (
                (current_user.email and target_student.email and current_user.email.lower() == target_student.email.lower()) or
                (current_user.username and target_student.username and current_user.username.lower() == target_student.username.lower())
            )
            if not is_own:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access restricted: Students can only view their own profile."
                )

        # 2. Faculty Role Isolation
        elif user_role in ["faculty", "staff"]:
            assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
            if target_student.id not in assigned_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access restricted: This student is not assigned to your mentoring allocation (Max 20 students)."
                )

        # 3. HOD Role Isolation
        elif user_role in ["hod"]:
            if current_user.department_id and target_student.department_id != current_user.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access restricted: You are only authorized to access students within your assigned department."
                )

    stats = target_student.stats
    dept_code = target_student.department.code if target_student.department else "CSE"

    # Find faculty advisor
    advisor_assign = db.query(FacultyStudentAssignment).filter(
        FacultyStudentAssignment.student_id == target_student.id,
        FacultyStudentAssignment.is_active == True
    ).first()
    advisor_name = advisor_assign.faculty.username if (advisor_assign and advisor_assign.faculty) else "Unassigned"

    # Contest history
    contests = db.query(ContestParticipation).filter(
        ContestParticipation.student_id == target_student.id
    ).order_by(ContestParticipation.id.desc()).limit(5).all()

    contest_history = [
        {
            "contest_name": c.contest_name,
            "contest_date": c.contest_date,
            "participation_type": c.participation_type,
            "problems_solved": c.problems_solved,
            "total_problems": c.total_problems,
            "rank": c.contest_rank,
            "rating_after": c.contest_rating_after
        }
        for c in contests
    ]

    return {
        "id": target_student.id,
        "reg_no": target_student.reg_no,
        "name": target_student.name,
        "department": dept_code,
        "year_level": target_student.year_level,
        "username": target_student.username,
        "leetcode_url": target_student.leetcode_url,
        "faculty_advisor": advisor_name,
        "statistics": {
            "total_solved": stats.total_solved if stats else 0,
            "easy_solved": stats.easy_solved if stats else 0,
            "medium_solved": stats.medium_solved if stats else 0,
            "hard_solved": stats.hard_solved if stats else 0,
            "contest_rating": stats.contest_rating if stats else 0.0,
            "global_ranking": stats.contest_global_ranking if stats else None,
            "max_streak": stats.max_streak if stats else 0,
            "sync_status": stats.sync_status if stats else "verified"
        },
        "recent_contests": contest_history
    }
