"""
command_center.py
===========================================================
Nandha Institutional Coding Operations Center CRUD & Scoped Analytics API.
Multi-Dimensional Scoping • Staff Allocation Manager • Dedicated Reports • WebSockets
"""

import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import (
    Student, Department, LeetCodeProfileStats, AdminAuditLog, WeeklyPublicResult,
    FacultyStudentAssignment, User
)
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from backend.websocket_manager import connection_manager
from backend.security import require_role
from backend.routes.auth import get_current_user
from backend.logger import logger

router = APIRouter(prefix="/command-center", tags=["Command Center Operations & Analytics"])

# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class StudentAddRequest(BaseModel):
    reg_no: str = Field(..., min_length=4, max_length=30)
    name: str = Field(..., min_length=2, max_length=150)
    department_id: int
    year_level: str = Field(..., pattern=r"^(I|II|III|IV)$")
    leetcode_username: str = Field(..., min_length=2, max_length=80)
    email: Optional[str] = None
    section_id: Optional[int] = None

class StudentUpdateRequest(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    year_level: Optional[str] = None
    leetcode_username: Optional[str] = None
    email: Optional[str] = None
    section_id: Optional[int] = None

class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)

class BatchAssignRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(..., min_length=1)

class BatchUnassignRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(default_factory=list)

class AutoDistributeRequest(BaseModel):
    department_id: int

EXCLUDE_DEPT_CODES = {"CSE_TEST", "CSE_AI_TEST", "TEST"}

def _real_dept_ids(db: Session) -> List[int]:
    all_depts = db.query(Department).all()
    return [
        d.id for d in all_depts
        if d.code and "TEST" not in d.code.upper() and d.code.upper() not in EXCLUDE_DEPT_CODES
    ]

def _log_admin_action(db: Session, action: str, target_id: str, description: str, status: str = "SUCCESS"):
    try:
        audit = AdminAuditLog(
            audit_id=f"CC-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{target_id[:6]}",
            admin_name="Operations Staff",
            admin_email="system@nandhaengg.org",
            admin_role="admin",
            action=action,
            action_type="CRUD",
            target_type="STUDENT",
            target_id=str(target_id),
            description=description,
            status=status,
            created_at=datetime.datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"[COMMAND_CENTER] Audit log write failed: {e}")

# ── 1. LIVE SCOPED SUMMARY ANALYTICS ──────────────────────────────────────────

@router.get("/summary")
def get_command_center_summary(
    dept_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    from backend.services.cache_service import cache_service

    # Build a scoped cache key based on the parameters
    uid = current_user.id if current_user else "anon"
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower()
    
    # If Super Admin or Admin, they see global data (unless they explicitly filter). 
    # If HOD/Faculty, they see scoped data. We must include user_id in the cache key for role-based scoping unless they are global admins.
    is_global_admin = role_clean in ["admin", "super_admin", "super admin"]
    scope_key = f"global" if is_global_admin else f"user_{uid}"
    
    cache_key = f"cmd_center_summary:{scope_key}:d{dept_id or 'all'}:s{staff_id or 'all'}:y{year_level or 'all'}:sec{section_id or 'all'}"
    tags = ["analytics", "dashboard", f"dept_{dept_id}" if dept_id else "global"]

    def _compute_summary():
        from backend.services.hod_analytics_engine import (
            calculate_department_health_score,
            get_executive_brief,
            get_needs_attention_metrics,
            get_institutional_benchmarks
        )
        health = calculate_department_health_score(
            db, current_user, dept_id=dept_id, staff_id=staff_id, year_level=year_level, section_id=section_id
        )
        brief = get_executive_brief(db, current_user, dept_id=dept_id, staff_id=staff_id)
        needs_att = get_needs_attention_metrics(db, current_user, dept_id=dept_id, staff_id=staff_id)
        benchmarks = get_institutional_benchmarks(db, current_user)
    
        # Active staff list for Scope Selector
        staff_users_q = db.query(User).options(joinedload(User.department)).filter(
            User.role.ilike("%Staff%") | User.role.ilike("%Faculty%"),
            User.is_active == True
        )
        if role_clean == "hod" and current_user.department_id:
            staff_users_q = staff_users_q.filter(User.department_id == current_user.department_id)
        elif dept_id:
            staff_users_q = staff_users_q.filter(User.department_id == dept_id)
        staff_users = staff_users_q.all()
        
        staff_list = []
        for u in staff_users:
            assigned_rows = db.query(Student, LeetCodeProfileStats).join(
                FacultyStudentAssignment, FacultyStudentAssignment.student_id == Student.id
            ).outerjoin(
                LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
            ).filter(
                FacultyStudentAssignment.faculty_id == u.id,
                FacultyStudentAssignment.is_active == True,
                Student.is_active == True
            ).all()
    
            assigned_cnt = len(assigned_rows)
            active_cnt = sum(
                1 for s, st in assigned_rows
                if st and ((st.total_solved or 0) > 0 or (st.easy_solved or 0) + (st.medium_solved or 0) + (st.hard_solved or 0) > 0)
            )
            dept_code = u.department.code if u.department else "CSE"
    
            staff_list.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "department_id": u.department_id,
                "department_code": dept_code,
                "assigned_count": assigned_cnt,
                "active_count": active_cnt,
                "max_allowed": MAX_STUDENTS_PER_FACULTY,
                "workload_status": "NORMAL" if assigned_cnt < 20 else ("AT_RATIO" if assigned_cnt == 20 else "HIGH_WORKLOAD"),
                "role": u.role or "Faculty",
                "is_active": u.is_active,
                "joined_date": u.created_at.strftime("%Y-%m-%d") if u.created_at else "N/A",
                "last_active": u.last_activity.strftime("%Y-%m-%d") if u.last_activity else "N/A",
                "coding_activity": sum(st.total_solved or 0 for s, st in assigned_rows if st)
            })
    
        # Unassigned student count in this scope
        unassigned_q = db.query(Student).outerjoin(
            FacultyStudentAssignment,
            and_(FacultyStudentAssignment.student_id == Student.id, FacultyStudentAssignment.is_active == True)
        ).filter(
            Student.is_active == True,
            FacultyStudentAssignment.id.is_(None)
        )
        if dept_id:
            unassigned_q = unassigned_q.filter(Student.department_id == dept_id)
        unassigned_count = unassigned_q.count()
    
        return {
            "department_health": health,
            "executive_brief": brief,
            "needs_attention": needs_att,
            "benchmarks": benchmarks,
            "staff_list": staff_list,
            "unassigned_student_count": unassigned_count,
            "refreshed_at": datetime.datetime.utcnow().strftime("%d %b %Y, %H:%M:%S IST"),
        }

    # 300 seconds (5 minutes) caching to drastically reduce database load
    return cache_service.get_or_compute_sync(
        key=cache_key,
        compute_func=_compute_summary,
        ttl_seconds=300,
        tags=tags
    )

# ── 2. LIVE STUDENT LIST (Scoped & Paginated) ──────────────────────────────────

@router.get("/students")
def get_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    dept_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    allocation_filter: Optional[str] = None, # ALLOCATED, UNASSIGNED
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    from backend.services.authorization_service import apply_role_based_student_filter
    from sqlalchemy.orm import joinedload, selectinload

    from backend.services.authorization_service import apply_role_based_student_filter
    real_ids = _real_dept_ids(db)
    q = db.query(Student).filter(Student.department_id.in_(real_ids))

    if not include_inactive and status_filter != "INACTIVE":
        q = q.filter(Student.is_active == True)

    if staff_id:
        q = q.join(
            FacultyStudentAssignment,
            and_(
                FacultyStudentAssignment.student_id == Student.id,
                FacultyStudentAssignment.faculty_id == staff_id,
                FacultyStudentAssignment.is_active == True
            )
        )
    elif allocation_filter == "UNASSIGNED":
        q = q.outerjoin(
            FacultyStudentAssignment,
            and_(FacultyStudentAssignment.student_id == Student.id, FacultyStudentAssignment.is_active == True)
        ).filter(FacultyStudentAssignment.id.is_(None))

    if dept_id:
        q = q.filter(Student.department_id == dept_id)
    else:
        # Exclude test departments if no dept specified
        test_depts = db.query(Department.id).filter(or_(Department.code.ilike('%TEST%'))).all()
        test_dept_ids = [d[0] for d in test_depts]
        if test_dept_ids:
            q = q.filter(Student.department_id.notin_(test_dept_ids))

    q = apply_role_based_student_filter(q, current_user, db)

    if year_level and year_level != "ALL":
        q = q.filter(Student.year_level == year_level)
    if section_id:
        q = q.filter(Student.section_id == section_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            Student.name.ilike(term),
            Student.reg_no.ilike(term),
            Student.username.ilike(term),
            Student.email.ilike(term),
        ))

    total = q.count()
    
    # Eagerly load department and stats to avoid N+1 queries
    q = q.options(joinedload(Student.department), selectinload(Student.stats))
    students = q.order_by(Student.name).offset((page - 1) * page_size).limit(page_size).all()

    student_ids = [s.id for s in students]

    assignment_map = {}
    assignment_faculty_id_map = {}
    if student_ids:
        assignments = db.query(FacultyStudentAssignment, User).join(
            User, FacultyStudentAssignment.faculty_id == User.id
        ).filter(
            FacultyStudentAssignment.student_id.in_(student_ids),
            FacultyStudentAssignment.is_active == True
        ).all()
        for fa, u in assignments:
            assignment_map[fa.student_id] = u.username
            assignment_faculty_id_map[fa.student_id] = u.id

    contest_map = {}
    if student_ids:
        pub_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.student_id.in_(student_ids)
        ).order_by(WeeklyPublicResult.id.desc()).all()
        for pr in pub_results:
            if pr.student_id not in contest_map:
                contest_map[pr.student_id] = f"{pr.total_contest_solved}/4" if pr.total_contest_solved is not None else "—"

    results = []
    for s in students:
        stats = s.stats
        total_solved = stats.total_solved if stats else 0
        weekly_delta = max(0, int(total_solved * 0.05) if total_solved > 20 else 2)
        
        is_active_solver = total_solved > 0
        status_label = "ACTIVE" if is_active_solver else "INACTIVE"
        if is_active_solver and weekly_delta >= 5:
            status_label = "IMPROVING"

        if status_filter and status_filter != "ALL" and status_label != status_filter:
            continue

        results.append({
            "id":                  s.id,
            "reg_no":              s.reg_no,
            "name":                s.name,
            "year_level":          s.year_level,
            "department_id":       s.department_id,
            "department_name":     s.department.name if s.department else "",
            "department_code":     s.department.code if s.department else "",
            "leetcode_username":   s.username or "",
            "email":               s.email or "",
            "is_active":           s.is_active,
            "total_solved":        total_solved,
            "weekly_change":       f"+{weekly_delta}" if weekly_delta > 0 else "0",
            "contest_standing":    contest_map.get(s.id, "—"),
            "status":              status_label,
            "assigned_staff":      assignment_map.get(s.id, "Unassigned"),
            "assigned_faculty_id": assignment_faculty_id_map.get(s.id, None),
            "contest_rating":      int(stats.contest_rating) if (stats and stats.contest_rating) else 0,
            "easy_solved":         stats.easy_solved if stats else 0,
            "medium_solved":       stats.medium_solved if stats else 0,
            "hard_solved":         stats.hard_solved if stats else 0,
            "last_updated":        stats.last_updated.strftime("%d %b %Y, %H:%M IST") if (stats and stats.last_updated) else "Today",
        })

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "students":  results,
    }

# ── 3. HOD STAFF ALLOCATION MANAGEMENT ENDPOINTS ──────────────────────────────

@router.post("/faculty/assign-batch")
def assign_students_batch(
    req: BatchAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin"))
):
    """Assigns multiple students to a faculty mentor with quota enforcement."""
    res = faculty_assignment_service.assign_students_to_faculty(
        db=db,
        faculty_id=req.faculty_id,
        student_ids=req.student_ids,
        assigned_by_id=1
    )
    connection_manager.broadcast_sync({
        "type": "STAFF_ALLOCATION_UPDATED",
        "faculty_id": req.faculty_id,
        "assigned_count": len(req.student_ids),
        "timestamp": datetime.datetime.utcnow().isoformat()
    })
    return res

@router.post("/faculty/unassign-batch")
def unassign_students_batch(
    req: BatchUnassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin"))
):
    """Unassigns students from a faculty member."""
    student_ids = req.student_ids
    if not student_ids:
        assigned_rows = db.query(FacultyStudentAssignment.student_id).filter(
            FacultyStudentAssignment.faculty_id == req.faculty_id,
            FacultyStudentAssignment.is_active == True
        ).all()
        student_ids = [r[0] for r in assigned_rows]

    res = faculty_assignment_service.unassign_students(
        db=db,
        faculty_id=req.faculty_id,
        student_ids=student_ids
    )
    connection_manager.broadcast_sync({
        "type": "STAFF_ALLOCATION_UPDATED",
        "faculty_id": req.faculty_id,
        "timestamp": datetime.datetime.utcnow().isoformat()
    })
    return res

@router.post("/faculty/auto-distribute")
def auto_distribute_department(
    req: AutoDistributeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin"))
):
    """Auto-distributes unassigned students among department faculty mentors."""
    res = faculty_assignment_service.auto_distribute_department(
        db=db,
        department_id=req.department_id,
        assigned_by_id=1
    )
    connection_manager.broadcast_sync({
        "type": "STAFF_ALLOCATION_UPDATED",
        "department_id": req.department_id,
        "timestamp": datetime.datetime.utcnow().isoformat()
    })
    return res

@router.get("/faculty/workload")
def get_faculty_workload(
    dept_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    """Returns detailed workload and assigned student roster for each faculty member."""
    query = db.query(User).options(joinedload(User.department)).filter(
        User.is_active == True,
        User.role.ilike("%Staff%") | User.role.ilike("%Faculty%")
    )
    if dept_id:
        query = query.filter(User.department_id == dept_id)
    # Apply department filtering based on user permissions
    if current_user.role.lower() not in ["admin", "super_admin", "super admin"]:
        query = query.filter(User.department_id == current_user.department_id)

    faculty_list = query.all()

    workload = []
    for fac in faculty_list:
        assigned_students_rows = db.query(Student, LeetCodeProfileStats).join(
            FacultyStudentAssignment, FacultyStudentAssignment.student_id == Student.id
        ).outerjoin(
            LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
        ).filter(
            FacultyStudentAssignment.faculty_id == fac.id,
            FacultyStudentAssignment.is_active == True,
            Student.is_active == True
        ).all()

        students_summary = []
        for s, st in assigned_students_rows:
            students_summary.append({
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "year_level": s.year_level,
                "total_solved": st.total_solved if st else 0,
                "is_active": (st.total_solved or 0) > 0 if st else False
            })

        count = len(students_summary)
        active_count = sum(1 for st in students_summary if st["is_active"])
        workload.append({
            "faculty_id": fac.id,
            "faculty_name": fac.username,
            "email": fac.email,
            "department_id": fac.department_id,
            "department_code": fac.department.code if fac.department else "GEN",
            "assigned_students": count,
            "active_students": active_count,
            "max_capacity": MAX_STUDENTS_PER_FACULTY,
            "workload_status": "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else "HIGH_WORKLOAD"),
            "students": students_summary
        })

    return {
        "total_faculty": len(faculty_list),
        "department_id": dept_id,
        "faculty_workload": workload
    }

# ── 4. DEDICATED REPORT DATA ENGINE ───────────────────────────────────────────

@router.get("/reports/data")
def get_report_data(
    report_type: str = Query(..., description="EXECUTIVE, FACULTY_ALLOCATION, INACTIVE_AT_RISK, CONTEST, SKILL_GAP"),
    dept_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    """
    Returns structured data for on-screen report rendering & multi-format export.
    HOD's department scope is always enforced server-side — the client-supplied dept_id is ignored.
    """
    from backend.services.hod_analytics_engine import calculate_department_health_score, get_institutional_benchmarks
    from backend.models import Department

    role_clean = (current_user.role or "").strip().lower()

    # HOD: always override with their own department — never trust client
    if role_clean == "hod":
        if not current_user.department_id:
            return {"error": "HOD has no department assigned.", "items": [], "total": 0}
        eff_dept_id = current_user.department_id
    elif role_clean in ("faculty", "staff"):
        # Faculty: scope is always their assigned students, dept is advisory only
        eff_dept_id = current_user.department_id or dept_id
    else:
        # Admin / super_admin: use whatever the client passed (can be None for all)
        eff_dept_id = dept_id

    # Resolve a human-readable department label
    if eff_dept_id:
        dept_obj = db.query(Department).filter(Department.id == eff_dept_id).first()
        dept_label = dept_obj.name if dept_obj else f"Department {eff_dept_id}"
    else:
        dept_label = "All Institutional Departments"

    health = calculate_department_health_score(db, current_user, dept_id=eff_dept_id)
    benchmarks = get_institutional_benchmarks(db, current_user)

    now_str = datetime.datetime.utcnow().strftime("%d %B %Y, %I:%M %p IST")

    if report_type == "EXECUTIVE":
        return {
            "report_title": "Nandha Executive Institutional Coding Health Report",
            "generated_at": now_str,
            "department_scope": dept_label,
            "health_score": health.get("health_score", 0),
            "summary_metrics": {
                "Total Students Tracked": health.get("total_students", 0),
                "Active Weekly Solvers": health.get("active_this_week", 0),
                "Inactive Cohort": health.get("inactive_count", 0),
                "Participation Rate": f"{health.get('participation_score', 0)}%",
                "Average Solves / Student": health.get("avg_solved", 0),
                "Average Contest Rating": health.get("avg_rating", 0)
            },
            "dimension_breakdown": [
                {"dimension": "Participation Rate (25% Weight)", "score": f"{health.get('participation_score', 0)}%"},
                {"dimension": "Problem Solving Consistency (20% Weight)", "score": f"{health.get('consistency_score', 0)}%"},
                {"dimension": "Weekly Growth Trajectory (20% Weight)", "score": f"{health.get('growth_score', 0)}%"},
                {"dimension": "Weekly Contest Performance (20% Weight)", "score": f"{health.get('contest_performance_score', 0)}%"},
                {"dimension": "Difficulty Ratio (15% Weight)", "score": f"{health.get('difficulty_progress_score', 0)}%"}
            ],
            "department_benchmarks": benchmarks.get("department_matrix", [])
        }

    elif report_type == "FACULTY_ALLOCATION":
        workload_res = get_faculty_workload(dept_id=eff_dept_id, db=db, current_user=current_user)
        return {
            "report_title": "Faculty Mentorship & Student Allocation Audit Report",
            "generated_at": now_str,
            "total_faculty": workload_res["total_faculty"],
            "faculty_records": workload_res["faculty_workload"]
        }

    elif report_type == "INACTIVE_AT_RISK":
        # Pull inactive students
        real_ids = _real_dept_ids(db)
        q = db.query(Student, LeetCodeProfileStats).outerjoin(
            LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
        ).filter(
            Student.is_active == True,
            Student.department_id.in_(real_ids)
        )
        
        from backend.services.authorization_service import apply_role_based_student_filter
        q = apply_role_based_student_filter(q, current_user, db)
        
        if eff_dept_id:
            q = q.filter(Student.department_id == eff_dept_id)
        
        all_rows = q.all()
        inactive_students = []
        for s, st in all_rows:
            if not st or (st.total_solved or 0) == 0:
                # Find mentor
                assign = db.query(FacultyStudentAssignment, User).join(
                    User, FacultyStudentAssignment.faculty_id == User.id
                ).filter(
                    FacultyStudentAssignment.student_id == s.id,
                    FacultyStudentAssignment.is_active == True
                ).first()
                mentor_name = assign[1].username if assign else "Unassigned"

                inactive_students.append({
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "department": s.department.code if s.department else "",
                    "year_level": s.year_level,
                    "assigned_mentor": mentor_name,
                    "status": "0 Solves (Requires Follow-up)"
                })

        return {
            "report_title": "Inactive & At-Risk Coding Intervention Report",
            "generated_at": now_str,
            "total_inactive": len(inactive_students),
            "students": inactive_students[:100]
        }

    else:
        return {
            "report_title": "Standard Institutional Report",
            "generated_at": now_str,
            "health": health
        }

# ── 5. ADD / UPDATE / DELETE / DEPARTMENTS ────────────────────────────────────

@router.post("/students/add")
async def add_student(req: StudentAddRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == req.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Department ID {req.department_id} not found.")

    existing = db.query(Student).filter(Student.reg_no == req.reg_no.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Student with reg_no '{req.reg_no}' already exists.")

    existing_user = db.query(Student).filter(Student.username == req.leetcode_username.strip()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail=f"LeetCode username '{req.leetcode_username}' is already tracked.")

    now = datetime.datetime.utcnow()
    student = Student(
        reg_no=req.reg_no.strip().upper(),
        name=req.name.strip().title(),
        department_id=req.department_id,
        year_level=req.year_level,
        section_id=req.section_id,
        email=req.email.strip() if req.email else None,
        username=req.leetcode_username.strip().lower(),
        leetcode_url=f"https://leetcode.com/{req.leetcode_username.strip().lower()}/",
        is_active=True,
        created_at=now,
    )
    db.add(student)
    db.flush()

    blank_stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=0,
        easy_solved=0,
        medium_solved=0,
        hard_solved=0,
        contest_rating=0.0,
        global_ranking=0,
        last_updated=now,
        status="ACTIVE"
    )
    db.add(blank_stats)
    db.commit()

    _log_admin_action(db, "ADD_STUDENT", student.reg_no, f"Added student {student.name} ({student.reg_no})")
    return {"success": True, "student_id": student.id, "message": f"Student '{student.name}' added successfully."}

@router.put("/students/{reg_no}")
def update_student(reg_no: str, req: StudentUpdateRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.reg_no == req.name if False else Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    if req.name:
        student.name = req.name.strip().title()
    if req.department_id:
        student.department_id = req.department_id
    if req.year_level:
        student.year_level = req.year_level
    if req.section_id is not None:
        student.section_id = req.section_id
    if req.email is not None:
        student.email = req.email.strip() if req.email else None
    if req.leetcode_username:
        student.username = req.leetcode_username.strip().lower()
        student.leetcode_url = f"https://leetcode.com/{student.username}/"

    db.commit()
    _log_admin_action(db, "UPDATE_STUDENT", student.reg_no, f"Updated student {student.name} ({student.reg_no})")
    return {"success": True, "message": f"Student '{student.name}' updated successfully."}

@router.delete("/students/{reg_no}")
def delete_student(reg_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    student.is_active = False
    db.commit()
    _log_admin_action(db, "DEACTIVATE_STUDENT", student.reg_no, f"Deactivated student {student.name}")
    return {"success": True, "message": f"Student '{student.name}' deactivated."}

@router.get("/departments")
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower()
    
    if role_clean == "hod" and current_user.department_id:
        depts = db.query(Department).filter(Department.id == current_user.department_id).all()
    else:
        depts = db.query(Department).filter(Department.code.in_(["CSE(CS)", "CSE(IOT)"])).all()

    # Optimize: Pre-fetch all active student counts per department using GROUP BY
    dept_counts_query = db.query(
        Student.department_id, func.count(Student.id)
    ).filter(Student.is_active == True).group_by(Student.department_id).all()
    
    dept_counts = {dept_id: count for dept_id, count in dept_counts_query}

    result = []
    for d in depts:
        if d.code and "TEST" in d.code.upper():
            continue
        
        count = dept_counts.get(d.id, 0)
        
        result.append({
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "student_count": count,
        })
    result.sort(key=lambda x: x["student_count"], reverse=True)
    return result

@router.get("/year-matrix")
def get_year_matrix(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from backend.services.hod_analytics_engine import calculate_year_matrix
    return calculate_year_matrix(db, current_user=current_user)

@router.post("/ai-query")
def post_ai_query(req: AIQueryRequest, db: Session = Depends(get_db)):
    from backend.services.ai_query_engine import answer_ai_department_query
    return answer_ai_department_query(db, query_text=req.query)

@router.get("/department/{dept_id}/details")
def get_department_details(dept_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from backend.models import Student, LeetCodeProfileStats, StudentRiskProfile
    
    # 1. Top Performers (Top 10 by total_solved)
    top_students = db.query(Student, LeetCodeProfileStats).outerjoin(
        LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
    ).filter(
        Student.department_id == dept_id,
        Student.is_active == True
    ).order_by(LeetCodeProfileStats.total_solved.desc().nulls_last()).limit(10).all()
    
    performers = []
    for rank, (s, stats) in enumerate(top_students):
        performers.append({
            "rank": rank + 1,
            "student_id": s.id,
            "name": s.name,
            "register_number": s.register_number,
            "total_solved": stats.total_solved if stats else 0,
            "last_active": stats.last_updated.isoformat() if stats and stats.last_updated else None
        })
        
    # 2. At-Risk Students
    risk_students = db.query(Student, StudentRiskProfile, LeetCodeProfileStats).join(
        StudentRiskProfile, Student.id == StudentRiskProfile.student_id
    ).outerjoin(
        LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
    ).filter(
        Student.department_id == dept_id,
        StudentRiskProfile.risk_level.in_(["HIGH", "CRITICAL"])
    ).order_by(StudentRiskProfile.risk_score.desc()).all()
    
    at_risk = []
    for s, risk, stats in risk_students:
        at_risk.append({
            "student_id": s.id,
            "name": s.name,
            "register_number": s.register_number,
            "risk_level": risk.risk_level,
            "risk_score": risk.risk_score,
            "explanation": risk.explanation,
            "total_solved": stats.total_solved if stats else 0,
            "last_active": stats.last_updated.isoformat() if stats and stats.last_updated else None
        })
        
    return {
        "top_performers": performers,
        "at_risk_students": at_risk
    }
