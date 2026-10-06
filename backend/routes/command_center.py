"""
command_center.py
===========================================================
Nandha Institutional Coding Operations Center CRUD & Scoped Analytics API.
Multi-Dimensional Scoping • Staff Allocation Manager • Dedicated Reports • WebSockets
"""

import datetime
import secrets
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

# Pydantic Schemas 

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
    student_ids: Optional[List[int]] = None

EXCLUDE_DEPT_CODES = {"CSE_TEST", "CSE_AI_TEST", "TEST"}

def _real_dept_ids(db: Session) -> List[int]:
    all_depts = db.query(Department).all()
    return [  # type: ignore
        d.id for d in all_depts
        if d.code and "TEST" not in d.code.upper() and d.code.upper() not in EXCLUDE_DEPT_CODES
    ]

def _log_admin_action(db: Session, action: str, target_id: str, description: str, status: str = "SUCCESS"):
    try:
        audit = AdminAuditLog(
            audit_id=f"CC-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(4).upper()}-{target_id[:6]}",
            admin_name="Operations Staff",
            admin_email="nanthishvaran17@gmail.com",
            admin_role="admin",
            action=action,
            action_type="CRUD",
            target_type="STUDENT",
            target_id=str(target_id),
            description=description,
            status=status,
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"[COMMAND_CENTER] Audit log write failed: {e}")

# 1. LIVE SCOPED SUMMARY ANALYTICS 

@router.get("/summary")
def get_command_center_summary(
    dept_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section_id: Optional[int] = None,
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    from backend.services.cache_service import cache_service

    uid = current_user.id if current_user else "anon"
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower()
    is_global_admin = role_clean in ["admin", "super_admin", "super admin", "administrator"]
    
    # Strictly enforce server-side department isolation for non-admin HODs
    if not is_global_admin and role_clean in ["hod", "head of department"] and current_user.department_id:
        dept_id = current_user.department_id  # type: ignore

    scope_key = f"global" if is_global_admin else f"user_{uid}"
    cache_key = f"cmd_center_summary:{scope_key}:d{dept_id or 'all'}:s{staff_id or 'all'}:y{year_level or 'all'}:sec{section_id or 'all'}"
    tags = ["analytics", "dashboard", f"dept_{dept_id}" if dept_id else "global"]

    if refresh:
        cache_service.invalidate(cache_key)
        cache_service.invalidate_tag("analytics")

    def _compute_summary():
        from backend.services.hod_analytics_engine import (
            calculate_department_health_score,
            get_executive_brief,
            get_needs_attention_metrics,
            get_institutional_benchmarks,
            calculate_department_kpi_summary,
            get_todays_action_items,
            get_year_section_heatmap
        )
        health = calculate_department_health_score(
            db, current_user, dept_id=dept_id, staff_id=staff_id, year_level=year_level, section_id=section_id
        )
        brief = get_executive_brief(db, current_user, dept_id=dept_id, staff_id=staff_id)
        needs_att = get_needs_attention_metrics(db, current_user, dept_id=dept_id, staff_id=staff_id)
        benchmarks = get_institutional_benchmarks(db, current_user)
        
        kpi_summary = calculate_department_kpi_summary(
            db, current_user, dept_id=dept_id, staff_id=staff_id, year_level=year_level, section_id=section_id
        )
        action_items = get_todays_action_items(db, current_user, dept_id=dept_id)
        heatmap_matrix = get_year_section_heatmap(db, current_user, dept_id=dept_id)

        # Department metadata
        dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else (
            current_user.department if current_user and current_user.department else None
        )
        dept_name = dept_obj.name if dept_obj else "Computer Science & Engineering"
        dept_code = dept_obj.code if dept_obj else "CSE"
        hod_name = current_user.username if current_user else "Head of Department"

        # Active staff list for Scope Selector & Performance Table
        staff_users_q = db.query(User).options(joinedload(User.department)).filter(
            User.role != "Student",
            User.is_active == True
        )
        if dept_id:
            staff_users_q = staff_users_q.filter(User.department_id == dept_id)
        staff_users = staff_users_q.all()
        
        # Single efficient aggregation query for all staff assignments
        from sqlalchemy import case, func, or_
        staff_assigned_stats_q = db.query(
            FacultyStudentAssignment.faculty_id.label("faculty_id"),
            func.count(Student.id).label("assigned_cnt"),
            func.sum(
                case(
                    (or_((LeetCodeProfileStats.total_solved > 0),
                         ((LeetCodeProfileStats.easy_solved + LeetCodeProfileStats.medium_solved + LeetCodeProfileStats.hard_solved) > 0)),
                     1),
                    else_=0
                )
            ).label("active_cnt"),
            func.sum(
                case(
                    (LeetCodeProfileStats.total_solved >= 10, 1),
                    else_=0
                )
            ).label("completed_cnt"),
            func.coalesce(func.sum(LeetCodeProfileStats.total_solved), 0).label("total_coding_activity")
        ).join(
            Student, FacultyStudentAssignment.student_id == Student.id
        ).outerjoin(
            LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
        ).filter(
            FacultyStudentAssignment.is_active == True,
            Student.is_active == True
        )
        if dept_id:
            staff_assigned_stats_q = staff_assigned_stats_q.filter(Student.department_id == dept_id)
        
        staff_assigned_rows = staff_assigned_stats_q.group_by(FacultyStudentAssignment.faculty_id).all()
        
        staff_stats_map = {
            r.faculty_id: {
                "assigned_cnt": int(r.assigned_cnt or 0),
                "active_cnt": int(r.active_cnt or 0),
                "completed_cnt": int(r.completed_cnt or 0),
                "coding_activity": int(r.total_coding_activity or 0)
            }
            for r in staff_assigned_rows
        }

        staff_list = []
        for u in staff_users:
            s_stat = staff_stats_map.get(u.id, {"assigned_cnt": 0, "active_cnt": 0, "completed_cnt": 0, "coding_activity": 0})
            assigned_cnt = s_stat["assigned_cnt"]
            active_cnt = s_stat["active_cnt"]
            completed_cnt = s_stat["completed_cnt"]
            coding_act = s_stat["coding_activity"]
            
            pending_cnt = max(0, assigned_cnt - completed_cnt)
            staff_prog = round((completed_cnt / float(assigned_cnt)) * 100.0, 1) if assigned_cnt > 0 else 0.0
            
            traffic_status = "GREEN" if staff_prog >= 80.0 else ("AMBER" if staff_prog >= 60.0 else "RED")
            d_code = u.department.code if u.department else dept_code

            staff_list.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "department_id": u.department_id,
                "department_code": d_code,
                "assigned_count": assigned_cnt,
                "active_count": active_cnt,
                "completed_count": completed_cnt,
                "pending_count": pending_cnt,
                "progress_pct": staff_prog,
                "traffic_status": traffic_status,
                "max_allowed": MAX_STUDENTS_PER_FACULTY,
                "workload_status": "NORMAL" if assigned_cnt < 20 else ("AT_RATIO" if assigned_cnt == 20 else "HIGH_WORKLOAD"),
                "role": u.role or "Faculty",
                "is_active": u.is_active,
                "joined_date": u.created_at.strftime("%Y-%m-%d") if u.created_at else "N/A",
                "last_active": u.last_activity.strftime("%Y-%m-%d") if u.last_activity else "N/A",
                "coding_activity": coding_act
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
            "header": {
                "hod_name": hod_name,
                "department_name": dept_name,
                "department_code": dept_code,
                "academic_year": "2025–26",
                "health_status": kpi_summary.get("progress_status", "GOOD"),
                "last_sync": datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M IST")
            },
            "kpi_summary": kpi_summary,
            "action_items": action_items,
            "heatmap_matrix": heatmap_matrix,
            "department_health": health,
            "executive_brief": brief,
            "needs_attention": needs_att,
            "benchmarks": benchmarks,
            "staff_list": staff_list,
            "unassigned_student_count": unassigned_count,
            "refreshed_at": datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y, %H:%M:%S IST"),
        }

    return cache_service.get_or_compute_sync(
        key=cache_key,
        compute_func=_compute_summary,
        ttl_seconds=300,
        tags=tags
    )

# 2. LIVE STUDENT LIST (Scoped & Paginated) 

@router.get("/students")
def get_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    dept_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section: Optional[str] = None,
    status_filter: Optional[str] = None,
    allocation_filter: Optional[str] = None, # ALLOCATED, UNASSIGNED
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    from backend.services.authorization_service import apply_role_based_student_filter
    from sqlalchemy.orm import joinedload, selectinload

    if not isinstance(page, int):
        try:
            page = int(page)
        except (TypeError, ValueError):
            page = 1
    if not isinstance(page_size, int):
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 20
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
        years_map_dict = {
            "I": ["1", "I", "1st", "I Year", "1 Year"],
            "II": ["2", "II", "2nd", "II Year", "2 Year"],
            "III": ["3", "III", "3rd", "III Year", "3 Year"],
            "IV": ["4", "IV", "4th", "IV Year", "4 Year"]
        }
        y_matches = years_map_dict.get(year_level, [year_level])
        q = q.filter(Student.year_level.in_(y_matches))
    if section and section != "ALL":
        from backend.models import Section
        q = q.filter(Student.section.has(Section.name.ilike(section)))
        
    if status_filter and status_filter != "ALL":
        if status_filter == "INACTIVE":
            q = q.outerjoin(LeetCodeProfileStats).filter(or_(LeetCodeProfileStats.id == None, LeetCodeProfileStats.total_solved == 0))
        elif status_filter == "ACTIVE":
            q = q.join(LeetCodeProfileStats).filter(LeetCodeProfileStats.total_solved > 0)
        elif status_filter == "AT_RISK":
            # Approximation for DB level AT_RISK filtering (0 solved)
            q = q.outerjoin(LeetCodeProfileStats).filter(or_(LeetCodeProfileStats.id == None, LeetCodeProfileStats.total_solved == 0))
        elif status_filter == "IMPROVING":
            # Approximation for DB level IMPROVING filtering
            q = q.join(LeetCodeProfileStats).filter(LeetCodeProfileStats.total_solved >= 5)

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
        total_solved = stats.total_solved if (stats and stats.total_solved is not None) else 0
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

# 3. HOD STAFF ALLOCATION MANAGEMENT ENDPOINTS 

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
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
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
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
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
        student_ids=req.student_ids,
        assigned_by_id=1
    )
    connection_manager.broadcast_sync({
        "type": "STAFF_ALLOCATION_UPDATED",
        "department_id": req.department_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
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
        or_(User.role.ilike("%Staff%"), User.role.ilike("%Faculty%"))
    )
    if dept_id:
        query = query.filter(User.department_id == dept_id)
    # Apply department filtering based on user permissions
    role_lower = (current_user.role or "").strip().lower()
    if role_lower not in ["admin", "super_admin", "super admin", "administrator"]:
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

# 4. DEDICATED REPORT DATA ENGINE 

@router.get("/reports/export-excel")
def export_command_center_report_excel(
    report_type: str = Query(..., description="EXECUTIVE, FACULTY_ALLOCATION, INACTIVE_AT_RISK, CONTEST, SKILL_GAP"),
    dept_id: Optional[int] = Query(None),
    year_level: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    staff_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    import io
    import os
    import openpyxl
    import openpyxl.utils
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.drawing.image import Image as ExcelImage
    from fastapi.responses import Response

    data = get_report_data(report_type, dept_id, year_level, section, staff_id, status_filter, db, current_user)

    wb = openpyxl.Workbook()
    ws = wb.active # type: ignore
    assert ws is not None
    ws.title = str(report_type)[:31]

    # STYLES
    title_font = Font(name="Times New Roman", size=18, bold=True, color="000080")
    subtitle_font = Font(name="Times New Roman", size=14, bold=True, color="333333")
    header_font = Font(name="Times New Roman", size=12, bold=True, color="FFFFFF")
    cell_font = Font(name="Times New Roman", size=11)
    bold_cell_font = Font(name="Times New Roman", size=11, bold=True)
    
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    
    thin_border = Border(left=Side(style="thin"), right=Side(style="thin"), top=Side(style="thin"), bottom=Side(style="thin"))

    col_span = 5
    if report_type == "INACTIVE_AT_RISK":
        col_span = 5
    elif report_type == "FACULTY_ALLOCATION":
        col_span = 5
    elif report_type == "EXECUTIVE":
        col_span = 5

    # Setup Title Headers - Balanced, compact executive spacing
    ws.row_dimensions[1].height = 46
    ws.row_dimensions[2].height = 24
    ws.row_dimensions[3].height = 20
    ws.row_dimensions[4].height = 10

    title = data.get("report_title", "Nandha Executive Institutional Coding Health Report")
    
    # 1. Main Title (Row 1)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=col_span)
    cell = ws.cell(row=1, column=1, value=title)
    cell.font = title_font
    cell.alignment = center_align

    # 2. Subtitle (Row 2)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=col_span)
    cell = ws.cell(row=2, column=1, value=data.get("department_scope", "All Departments"))
    cell.font = subtitle_font
    cell.alignment = center_align

    # 3. Generated At (Row 3)
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=col_span)
    cell = ws.cell(row=3, column=1, value=f"Generated At: {data.get('generated_at', '')}")
    cell.font = cell_font
    cell.alignment = center_align

    # IMAGES
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        logo1_path = os.path.join(base_dir, "assets", "nandha_emblem.png")
        logo2_path = os.path.join(base_dir, "assets", "nec_25_years_logo.png")
        
        if os.path.exists(logo1_path):
            img1 = ExcelImage(logo1_path)
            # Resize appropriately
            img1.width = 90
            img1.height = 80
            # Anchor to A1
            ws.add_image(img1, "A1")
            
        if os.path.exists(logo2_path):
            img2 = ExcelImage(logo2_path)
            img2.width = 120
            img2.height = 80
            last_col_letter = openpyxl.utils.get_column_letter(col_span)
            ws.add_image(img2, f"{last_col_letter}1")
    except Exception as e:
        print("Image error:", e)
        pass

    ws.append([]) # Empty row

    # DATA POPULATION
    if report_type == "EXECUTIVE":
        metrics = data.get("summary_metrics", {})
        for k, v in metrics.items():
            ws.append([k, "", "", "", v])
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
            ws.cell(row=ws.max_row, column=1).font = bold_cell_font
            ws.cell(row=ws.max_row, column=5).font = cell_font
            ws.cell(row=ws.max_row, column=5).alignment = center_align
            
            # Apply borders
            for c in range(1, 6):
                ws.cell(row=ws.max_row, column=c).border = thin_border
                if ws.max_row % 2 == 0:
                    ws.cell(row=ws.max_row, column=c).fill = alt_row_fill

        ws.append([])
        
        headers = ["Dimension", "", "", "", "Score"]
        ws.append(headers)
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
        for col_idx in range(1, 6):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border
            
        for row in data.get("dimension_breakdown", []):
            ws.append([row.get("dimension"), "", "", "", row.get("score")])
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
            for col_idx in range(1, 6):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.font = cell_font
                cell.border = thin_border
                if ws.max_row % 2 == 0:
                    cell.fill = alt_row_fill
                if col_idx == 5:
                    cell.alignment = center_align

    elif report_type == "FACULTY_ALLOCATION":
        headers = ["Faculty Mentor", "Dept", "Assigned", "Active Solvers", "Ratio Status"]
        ws.append(headers)
        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border
            
        for fac in data.get("faculty_records", []):
            ws.append([fac.get("faculty_name"), fac.get("department_code"), fac.get("assigned_students"), fac.get("active_students"), fac.get("workload_status")])
            for col_idx in range(1, 6):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.font = cell_font
                cell.border = thin_border
                if ws.max_row % 2 == 0:
                    cell.fill = alt_row_fill
                if col_idx > 2:
                    cell.alignment = center_align

    elif report_type == "INACTIVE_AT_RISK":
        ws.append([f"Total Inactive Solvers: {data.get('total_inactive', 0)}"])
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=5)
        ws.cell(row=ws.max_row, column=1).font = bold_cell_font
        ws.cell(row=ws.max_row, column=1).alignment = center_align
        ws.append([])
        
        headers = ["Reg No", "Student Name", "Dept", "Assigned Faculty Mentor", "Status"]
        ws.append(headers)
        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border
            
        for st in data.get("students", []):
            ws.append([st.get("reg_no"), st.get("name"), st.get("department"), st.get("assigned_mentor"), "INACTIVE"])
            for col_idx in range(1, 6):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.font = cell_font
                cell.border = thin_border
                if ws.max_row % 2 == 0:
                    cell.fill = alt_row_fill
                if col_idx in [1, 3, 5]:
                    cell.alignment = center_align

    # Format Column Widths Automatically based on content length
    for col_idx_num, col in enumerate(ws.columns, 1):
        max_length = 0
        column = openpyxl.utils.get_column_letter(col_idx_num)
        for cell in col:
            try:
                # Don't let the title row dictate the entire column width excessively
                if cell.row > 4 and cell.value:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
            except:
                pass
        
        # Enforce minimums so logos fit
        if column == "A":
            max_length = max(max_length, 35)
        elif column == openpyxl.utils.get_column_letter(col_span):
            max_length = max(max_length, 25)
            
        adjusted_width = (max_length + 4)
        ws.column_dimensions[column].width = adjusted_width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="CommandCenter_{report_type}.xlsx"'}
    )

@router.get("/reports/data")
def get_report_data(
    report_type: str = Query(..., description="EXECUTIVE, FACULTY_ALLOCATION, INACTIVE_AT_RISK, CONTEST, SKILL_GAP"),
    dept_id: Optional[int] = Query(None),
    year_level: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    staff_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hod", "admin", "super_admin", "super admin", "faculty", "staff"))
):
    """
    Returns structured data for on-screen report rendering & multi-format export.
    Supports dynamic combined filtering across Department, Year Level, Section, Staff, and Status.
    Enforces role-based boundaries server-side.
    """
    from backend.services.hod_analytics_engine import calculate_department_health_score, get_institutional_benchmarks
    from backend.models import Department, Section

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
        # Admin / super_admin: use whatever the client passed (can be None/0 for all)
        eff_dept_id = dept_id if dept_id and dept_id != 0 else None

    # Resolve human-readable department label
    if eff_dept_id:
        dept_obj = db.query(Department).filter(Department.id == eff_dept_id).first()
        dept_label = dept_obj.name if dept_obj else f"Department {eff_dept_id}"
    else:
        dept_label = "All Institutional Departments"

    eff_year = year_level if year_level and year_level != "ALL" else None
    eff_section = section if section and section != "ALL" else None
    eff_staff = staff_id if staff_id and staff_id != 0 else None
    eff_status = status_filter if status_filter and status_filter != "ALL" else None

    # Resolve section ID if section string passed
    sec_id = None
    if eff_section:
        sec_obj = db.query(Section).filter(Section.name.ilike(eff_section)).first()
        if sec_obj:
            sec_id = sec_obj.id

    health = calculate_department_health_score(
        db,
        current_user,
        dept_id=eff_dept_id,  # type: ignore
        staff_id=eff_staff,
        year_level=eff_year,
        section_id=sec_id  # type: ignore
    )
    benchmarks = get_institutional_benchmarks(db, current_user)

    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%d %B %Y, %I:%M %p IST")

    # Scope Summary Pills
    scope_details = [f"Dept: {dept_label}"]
    if eff_year:
        scope_details.append(f"Year: {eff_year}")
    if eff_section:
        scope_details.append(f"Sec: {eff_section}")
    if eff_staff:
        staff_user = db.query(User).filter(User.id == eff_staff).first()
        if staff_user:
            scope_details.append(f"Staff: {staff_user.username}")
    if eff_status:
        scope_details.append(f"Status: {eff_status}")

    scope_summary_str = " • ".join(scope_details)

    if report_type == "EXECUTIVE":
        return {
            "report_title": f"Nandha Executive Institutional Coding Health Report ({dept_label})",
            "generated_at": now_str,
            "department_scope": scope_summary_str,
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
        workload_res = get_faculty_workload(dept_id=eff_dept_id, db=db, current_user=current_user)  # type: ignore
        return {
            "report_title": "Faculty Mentorship & Student Allocation Audit Report",
            "generated_at": now_str,
            "department_scope": scope_summary_str,
            "total_faculty": workload_res["total_faculty"],
            "faculty_records": workload_res["faculty_workload"]
        }

    elif report_type == "INACTIVE_AT_RISK":
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
        if eff_year:
            q = q.filter(Student.year_level == eff_year)
        if eff_section:
            q = q.filter(Student.section.has(Section.name.ilike(eff_section)))
        if eff_staff:
            q = q.join(
                FacultyStudentAssignment,
                and_(
                    FacultyStudentAssignment.student_id == Student.id,
                    FacultyStudentAssignment.faculty_id == eff_staff,
                    FacultyStudentAssignment.is_active == True
                )
            )
        
        all_rows = q.all()
        inactive_students = []
        for s, st in all_rows:
            if not st or (st.total_solved or 0) == 0:
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
            "report_title": f"Inactive & At-Risk Coding Intervention Report ({dept_label})",
            "generated_at": now_str,
            "department_scope": scope_summary_str,
            "total_inactive": len(inactive_students),
            "students": inactive_students[:100]
        }

    else:
        return {
            "report_title": "Standard Institutional Report",
            "generated_at": now_str,
            "department_scope": scope_summary_str,
            "health": health
        }

# 5. ADD / UPDATE / DELETE / DEPARTMENTS 

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

    now = datetime.datetime.now(datetime.timezone.utc)
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

    _log_admin_action(db, "ADD_STUDENT", student.reg_no, f"Added student {student.name} ({student.reg_no})")  # type: ignore
    return {"success": True, "student_id": student.id, "message": f"Student '{student.name}' added successfully."}

@router.put("/students/{reg_no}")
def update_student(reg_no: str, req: StudentUpdateRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.reg_no == req.name if False else Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    if req.name:
        student.name = req.name.strip().title()  # type: ignore
    if req.department_id:
        student.department_id = req.department_id  # type: ignore
    if req.year_level:
        student.year_level = req.year_level  # type: ignore
    if req.section_id is not None:
        student.section_id = req.section_id  # type: ignore
    if req.email is not None:
        student.email = req.email.strip() if req.email else None  # type: ignore
    if req.leetcode_username:
        student.username = req.leetcode_username.strip().lower()  # type: ignore
        student.leetcode_url = f"https://leetcode.com/{student.username}/"  # type: ignore

    db.commit()
    _log_admin_action(db, "UPDATE_STUDENT", student.reg_no, f"Updated student {student.name} ({student.reg_no})")  # type: ignore
    return {"success": True, "message": f"Student '{student.name}' updated successfully."}

@router.delete("/students/{reg_no}")
def delete_student(reg_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    student.is_active = False  # type: ignore
    db.commit()
    _log_admin_action(db, "DEACTIVATE_STUDENT", student.reg_no, f"Deactivated student {student.name}")  # type: ignore
    return {"success": True, "message": f"Student '{student.name}' deactivated."}

@router.get("/departments")
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower()
    
    if role_clean == "hod" and current_user.department_id:
        depts = db.query(Department).filter(Department.id == current_user.department_id).all()
    else:
        # Load all production departments (exclude test/demo departments)
        from backend.constants import is_production_department
        all_depts = db.query(Department).all()
        depts = [d for d in all_depts if is_production_department(d.code)]  # type: ignore

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
        name = "Information Technology" if (d.code and d.code.upper() == "IT") else d.name
        
        result.append({
            "id": d.id,
            "name": name,
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
            "register_number": getattr(s, "reg_no", None) or getattr(s, "register_number", None),
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
            "register_number": getattr(s, "reg_no", None) or getattr(s, "register_number", None),
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

