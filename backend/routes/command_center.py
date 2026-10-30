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
from sqlalchemy import func, or_, and_, case
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import (
    Student, Department, LeetCodeProfileStats, AdminAuditLog, WeeklyPublicResult,
    FacultyStudentAssignment, User, WeeklySession
)
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from backend.websocket_manager import connection_manager
from backend.security import require_role
from backend.routes.auth import get_current_user
from backend.logger import logger
from backend.constants import is_production_department

def _is_real_dept(dept_code: Optional[str]) -> bool:
    if not dept_code:
        return True
    return is_production_department(dept_code)

def _get_active_or_latest_sunday_session(db: Session) -> Optional[WeeklySession]:
    """
    Finds the authoritative Sunday Weekly Contest session.
    Prioritizes LIVE / active session if currently happening, or the most recent finalized/completed
    weekly contest session that contains actual verified student participation records.
    """
    ATTENDED_STATUSES = ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED")
    
    # 1. LIVE session takes top precedence
    live_sess = db.query(WeeklySession).filter(
        WeeklySession.status == "LIVE",
        or_(WeeklySession.session_code.like("WEEK-%"), WeeklySession.contest_name.ilike("%Weekly Contest%"))
    ).order_by(WeeklySession.id.desc()).first()
    if live_sess:
        return live_sess

    # 2. Check for recent weekly contest sessions with real attended records
    candidates = db.query(WeeklySession).filter(
        or_(WeeklySession.session_code.like("WEEK-%"), WeeklySession.contest_name.ilike("%Weekly Contest%")),
        WeeklySession.status.in_(["FINALIZED", "COMPLETED", "VERIFIED", "ARCHIVED"])
    ).order_by(WeeklySession.id.desc()).all()

    for cand in candidates:
        has_attended = db.query(WeeklyPublicResult.id).filter(
            WeeklyPublicResult.session_id == cand.id,
            or_(
                WeeklyPublicResult.participation_status.in_(ATTENDED_STATUSES),
                WeeklyPublicResult.total_contest_solved > 0
            )
        ).first()
        if has_attended:
            return cand

    return candidates[0] if candidates else None

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
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower() if current_user else "admin"
    is_placement = any(p in role_clean for p in ["placement", "placement coordinator", "placement_coordinator", "placement officer", "placement_officer"])
    is_global_admin = is_placement or role_clean in ["admin", "super_admin", "super admin", "administrator", "principal", "management", "director"]
    
    # Strictly enforce server-side department isolation for non-admin departmental HODs (not placement coordinators)
    is_hod = ("hod" in role_clean or "head of department" in role_clean or role_clean in ["department hod", "department_hod"]) and not is_placement
    if current_user and not is_global_admin and is_hod:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if auth_dept_ids:
            if dept_id and dept_id in auth_dept_ids:
                pass
            else:
                dept_id = auth_dept_ids[0] if len(auth_dept_ids) == 1 else (dept_id if (dept_id and dept_id in auth_dept_ids) else None)
        elif current_user.department_id:
            dept_id = current_user.department_id

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
        benchmarks = get_institutional_benchmarks(db, current_user, dept_id=dept_id)
        
        kpi_summary = calculate_department_kpi_summary(
            db, current_user, dept_id=dept_id, staff_id=staff_id, year_level=year_level, section_id=section_id
        )
        action_items = get_todays_action_items(
            db, current_user,
            dept_id=dept_id,
            staff_id=staff_id,
            year_level=year_level,
            section_id=section_id
        )
        heatmap_matrix = get_year_section_heatmap(db, current_user, dept_id=dept_id)

        auth_depts = get_hod_authorized_department_ids(db, current_user) if (is_hod and not is_global_admin) else None
        prod_dept_ids = auth_depts if auth_depts else [d.id for d in db.query(Department).all() if _is_real_dept(str(d.code))]

        # Department metadata
        dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else (
            current_user.department if current_user and current_user.department else None
        )
        if not dept_id and auth_depts and len(auth_depts) > 1:
            dept_name = "All Authorized Departments"
            dept_code = "ALL"
        else:
            dept_name = dept_obj.name if dept_obj else "Computer Science & Engineering"
            dept_code = dept_obj.code if dept_obj else "CSE"

        # Resolve HOD name strictly (never show placement coordinator as HOD)
        CANONICAL_HOD_MAP = {
            "IT": "Dr. M. Senthilkumar",
            "CSE(CS)": "Dr. S. Prabhu",
            "CSE(IOT)": "Dr. S. Karthikeyan",
            "CSE": "Dr. S. Prabhu",
        }
        user_role_clean = (current_user.role or "").lower() if current_user else ""
        is_real_hod = "hod" in user_role_clean and not any(r in user_role_clean for r in ["placement", "coordinator", "faculty", "staff"])
        if is_real_hod:
            hod_name = current_user.full_name or current_user.username
        elif dept_obj and dept_obj.code:
            hod_name = CANONICAL_HOD_MAP.get(dept_obj.code.upper(), f"HOD ({dept_obj.code})")
        else:
            hod_name = "Head of Department"


        # Active staff list for Scope Selector & Performance Table
        STAFF_MENTOR_ROLES = [
            "faculty", "staff", "professor", "faculty mentor", "staff mentor",
            "faculty_mentor", "staff_mentor", "faculty coordinator", "staff coordinator",
            "faculty_coordinator", "staff_coordinator", "placement coordinator",
            "placement_coordinator", "coordinator", "academic coordinator",
            "mentor", "tutor", "proctor", "class advisor", "hod", "department hod", "department_hod"
        ]
        assigned_faculty_ids_subq = db.query(FacultyStudentAssignment.faculty_id).filter(
            FacultyStudentAssignment.is_active == True
        ).distinct()

        staff_users_q = db.query(User).options(joinedload(User.department)).filter(
            or_(
                func.lower(User.role).in_(STAFF_MENTOR_ROLES),
                User.role.ilike("%Faculty%"),
                User.role.ilike("%Staff%"),
                User.role.ilike("%Placement%"),
                User.role.ilike("%Coordinator%"),
                User.role.ilike("%Mentor%"),
                User.role.ilike("%HOD%"),
                User.id.in_(assigned_faculty_ids_subq)
            ),
            ~func.lower(User.role).in_(["admin", "super admin", "super_admin", "administrator", "student"]),
            ~User.username.ilike("test_%"),
            ~User.username.ilike("dummy_%"),
            ~User.username.ilike("sec_test_%"),
            ~User.username.ilike("hardening_%"),
            User.is_active == True
        )
        if dept_id:
            staff_users_q = staff_users_q.filter(
                or_(
                    User.department_id == dept_id,
                    User.id.in_(
                        db.query(FacultyStudentAssignment.faculty_id).join(
                            Student, FacultyStudentAssignment.student_id == Student.id
                        ).filter(
                            FacultyStudentAssignment.is_active == True,
                            Student.department_id == dept_id
                        )
                    )
                )
            )
        else:
            staff_users_q = staff_users_q.filter(
                or_(
                    User.department_id.in_(prod_dept_ids),
                    User.department_id.is_(None),
                    User.id.in_(
                        db.query(FacultyStudentAssignment.faculty_id).join(
                            Student, FacultyStudentAssignment.student_id == Student.id
                        ).filter(
                            FacultyStudentAssignment.is_active == True,
                            Student.department_id.in_(prod_dept_ids)
                        )
                    )
                )
            )
        staff_users = staff_users_q.all()
        
        # Single efficient aggregation query for all staff assignments
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
        else:
            staff_assigned_stats_q = staff_assigned_stats_q.filter(Student.department_id.in_(prod_dept_ids))
        
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

        # Authoritative Sunday Contest Attendance for latest/live session
        active_sunday_session = _get_active_or_latest_sunday_session(db)
        staff_sunday_stats_map = {}
        if active_sunday_session:
            ATTENDED_STATUSES = ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED")
            staff_sunday_q = db.query(
                FacultyStudentAssignment.faculty_id,
                func.count(WeeklyPublicResult.id)
            ).join(
                Student, FacultyStudentAssignment.student_id == Student.id
            ).join(
                WeeklyPublicResult, and_(
                    WeeklyPublicResult.student_id == Student.id,
                    WeeklyPublicResult.session_id == active_sunday_session.id,
                    or_(
                        WeeklyPublicResult.participation_status.in_(ATTENDED_STATUSES),
                        WeeklyPublicResult.total_contest_solved > 0,
                        and_(WeeklyPublicResult.contest_rank.isnot(None), WeeklyPublicResult.contest_rank > 0)
                    )
                )
            ).filter(
                FacultyStudentAssignment.is_active == True,
                Student.is_active == True
            )
            if dept_id:
                staff_sunday_q = staff_sunday_q.filter(Student.department_id == dept_id)
            else:
                staff_sunday_q = staff_sunday_q.filter(Student.department_id.in_(prod_dept_ids))
            
            for fid, cnt in staff_sunday_q.group_by(FacultyStudentAssignment.faculty_id).all():
                staff_sunday_stats_map[fid] = int(cnt or 0)

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
            d_code = u.department.code if u.department else (
                db.query(Department.code).join(Student, Student.department_id == Department.id).join(
                    FacultyStudentAssignment, FacultyStudentAssignment.student_id == Student.id
                ).filter(FacultyStudentAssignment.faculty_id == u.id, FacultyStudentAssignment.is_active == True).limit(1).scalar() or dept_code
            )

            sunday_att_cnt = staff_sunday_stats_map.get(u.id, 0)
            sunday_turnout = round((sunday_att_cnt / float(assigned_cnt)) * 100.0) if assigned_cnt > 0 else 0

            staff_list.append({
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name or u.username,
                "email": u.email,
                "department_id": u.department_id,
                "department": d_code,
                "department_code": d_code,
                "assigned_count": assigned_cnt,
                "active_count": active_cnt,
                "completed_count": completed_cnt,
                "pending_count": pending_cnt,
                "progress_pct": staff_prog,
                "traffic_status": traffic_status,
                "max_allowed": None,
                "workload_status": "NORMAL" if assigned_cnt < 20 else ("AT_RATIO" if assigned_cnt == 20 else "HIGH_WORKLOAD"),
                "is_allocated": bool(assigned_cnt > 0),
                "allocation_status": "ALLOCATED" if assigned_cnt > 0 else "UNALLOCATED",
                "role": u.role or "Faculty",
                "is_active": u.is_active,
                "joined_date": u.created_at.strftime("%Y-%m-%d") if u.created_at else "N/A",
                "last_active": u.last_login.strftime("%Y-%m-%d") if getattr(u, 'last_login', None) else "N/A",
                "coding_activity": coding_act,
                "sunday_contest_attended": sunday_att_cnt,
                "sunday_contest_turnout_pct": sunday_turnout,
                "sunday_contest_session_name": active_sunday_session.contest_name if active_sunday_session else "Sunday Contest",
                "sunday_contest_session_date": active_sunday_session.session_date if active_sunday_session else ""
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
        else:
            unassigned_q = unassigned_q.filter(Student.department_id.in_(prod_dept_ids))
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
    elif allocation_filter == "ALLOCATED":
        q = q.join(
            FacultyStudentAssignment,
            and_(FacultyStudentAssignment.student_id == Student.id, FacultyStudentAssignment.is_active == True)
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

    if year_level and str(year_level).strip().upper() not in ("ALL", "ALL YEARS", "ALL_YEARS", ""):
        from backend.constants import get_academic_year_filter_clause
        yr_clause = get_academic_year_filter_clause(Student, year_level)
        if yr_clause is not None:
            q = q.filter(yr_clause)
    if section and section != "ALL":
        from backend.models import Section
        q = q.filter(Student.section.has(Section.name.ilike(section)))
        
    if status_filter and status_filter != "ALL":
        if status_filter in ["INACTIVE", "ZERO_SOLVED", "ZERO", "ZERO_SOLVED_PENDING"]:
            q = q.outerjoin(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) == 0
            )
        elif status_filter == "ACTIVE":
            q = q.join(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) > 0
            )
        elif status_filter == "AT_RISK":
            # Approximation for DB level AT_RISK filtering (0 solved)
            q = q.outerjoin(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) == 0
            )
        elif status_filter == "IMPROVING":
            # Approximation for DB level IMPROVING filtering
            q = q.join(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) >= 5
            )
        elif status_filter == "COMPLETED":
            # Target Achieved: total_solved >= 10
            q = q.join(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) >= 10
            )
        elif status_filter == "PENDING":
            # Target In Progress: total_solved < 10 (properly matches 0..9 and NULL/uncalculated)
            q = q.outerjoin(LeetCodeProfileStats).filter(
                func.coalesce(LeetCodeProfileStats.total_solved, 0) < 10
            )

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

    contest_standing_map = {}
    contest_attended_map = {}
    contest_status_map = {}
    contest_session_name = ""
    contest_session_date = ""

    active_sunday_session = _get_active_or_latest_sunday_session(db)
    if active_sunday_session:
        contest_session_name = active_sunday_session.contest_name or "Sunday Contest"
        contest_session_date = active_sunday_session.session_date or ""
        if student_ids:
            ATTENDED_STATUSES = {"PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED"}
            pub_results = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.student_id.in_(student_ids),
                WeeklyPublicResult.session_id == active_sunday_session.id
            ).all()
            for pr in pub_results:
                is_att = (
                    (pr.participation_status in ATTENDED_STATUSES) or
                    ((pr.total_contest_solved or 0) > 0) or
                    (pr.contest_rank is not None and pr.contest_rank > 0)
                )
                contest_attended_map[pr.student_id] = is_att
                contest_status_map[pr.student_id] = pr.participation_status or ("ATTENDED" if is_att else "NOT_ATTENDED")
                if is_att:
                    solved = pr.total_contest_solved if pr.total_contest_solved is not None else 0
                    contest_standing_map[pr.student_id] = f"{solved}/4"
                else:
                    contest_standing_map[pr.student_id] = "Absent"

    results = []
    for s in students:
        stats = s.stats
        total_solved = stats.total_solved if (stats and stats.total_solved is not None) else 0
        weekly_delta = max(0, int(total_solved * 0.05) if total_solved > 20 else 2)
        
        is_active_solver = total_solved > 0
        status_label = "ACTIVE" if is_active_solver else "INACTIVE"
        if is_active_solver and weekly_delta >= 5:
            status_label = "IMPROVING"

        if status_filter and status_filter != "ALL":
            if status_filter == "PENDING" and total_solved >= 10:
                continue
            elif status_filter == "COMPLETED" and total_solved < 10:
                continue
            elif status_filter == "AT_RISK" and total_solved > 0:
                continue
            elif status_filter == "INACTIVE" and is_active_solver:
                continue
            elif status_filter == "ACTIVE" and not is_active_solver:
                continue
            elif status_filter == "IMPROVING" and not (is_active_solver and weekly_delta >= 5):
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
            "contest_standing":    contest_standing_map.get(s.id, "—"),
            "contest_attended":    contest_attended_map.get(s.id, False),
            "contest_status":      contest_status_map.get(s.id, "NOT_ATTENDED"),
            "contest_session_name": contest_session_name,
            "contest_session_date": contest_session_date,
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
        assigned_by_id=int(current_user.id) if current_user and getattr(current_user, "id", None) else None
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
        assigned_by_id=int(current_user.id) if current_user and getattr(current_user, "id", None) else None
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
    STAFF_MENTOR_ROLES = [
        "faculty", "staff", "professor", "faculty mentor", "staff mentor",
        "faculty_mentor", "staff_mentor", "faculty coordinator", "staff coordinator",
        "faculty_coordinator", "staff_coordinator", "placement coordinator",
        "placement_coordinator", "coordinator", "academic coordinator",
        "mentor", "tutor", "proctor", "class advisor"
    ]
    assigned_faculty_subq = db.query(FacultyStudentAssignment.faculty_id).filter(
        FacultyStudentAssignment.is_active == True
    ).distinct()

    query = db.query(User).options(joinedload(User.department)).filter(
        User.is_active == True,
        or_(
            func.lower(User.role).in_(STAFF_MENTOR_ROLES),
            User.role.ilike("%Staff%"),
            User.role.ilike("%Faculty%"),
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
    if dept_id:
        query = query.filter(
            or_(
                User.department_id == dept_id,
                User.id.in_(
                    db.query(FacultyStudentAssignment.faculty_id).join(
                        Student, FacultyStudentAssignment.student_id == Student.id
                    ).filter(
                        FacultyStudentAssignment.is_active == True,
                        Student.department_id == dept_id
                    )
                )
            )
        )
    # Apply department filtering based on user permissions
    role_lower = (current_user.role or "").strip().lower()
    is_placement_coord = any(p in role_lower for p in ["placement", "placement coordinator", "placement_coordinator", "placement officer", "placement_officer"])
    is_admin_user = role_lower in ["admin", "super_admin", "super admin", "administrator", "principal", "management", "director"] or is_placement_coord
    if not is_admin_user and current_user.department_id:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if auth_dept_ids:
            if dept_id and dept_id in auth_dept_ids:
                pass  # Allow explicitly selected authorized dept
            else:
                query = query.filter(
                    or_(
                        User.department_id.in_(auth_dept_ids),
                        User.id.in_(
                            db.query(FacultyStudentAssignment.faculty_id).join(
                                Student, FacultyStudentAssignment.student_id == Student.id
                            ).filter(
                                FacultyStudentAssignment.is_active == True,
                                Student.department_id.in_(auth_dept_ids)
                            )
                        )
                    )
                )
        else:
            query = query.filter(
                or_(
                    User.department_id == current_user.department_id,
                    User.id.in_(
                        db.query(FacultyStudentAssignment.faculty_id).join(
                            Student, FacultyStudentAssignment.student_id == Student.id
                        ).filter(
                            FacultyStudentAssignment.is_active == True,
                            Student.department_id == current_user.department_id
                        )
                    )
                )
            )

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
        inactive_count = count - active_count
        conversion_rate_pct = round((active_count / count * 100), 1) if count > 0 else 0.0
        total_solves = sum((st["total_solved"] or 0) for st in students_summary)
        avg_solves = round(total_solves / count, 1) if count > 0 else 0.0

        workload.append({
            "faculty_id": fac.id,
            "faculty_name": fac.full_name or fac.username,
            "username": fac.username,
            "full_name": fac.full_name or fac.username,
            "email": fac.email,
            "role": fac.role or "Faculty",
            "department_id": fac.department_id or (
                db.query(Student.department_id).join(
                    FacultyStudentAssignment, FacultyStudentAssignment.student_id == Student.id
                ).filter(FacultyStudentAssignment.faculty_id == fac.id, FacultyStudentAssignment.is_active == True).limit(1).scalar()
            ),
            "department_code": fac.department.code if fac.department else (
                db.query(Department.code).join(Student, Student.department_id == Department.id).join(
                    FacultyStudentAssignment, FacultyStudentAssignment.student_id == Student.id
                ).filter(FacultyStudentAssignment.faculty_id == fac.id, FacultyStudentAssignment.is_active == True).limit(1).scalar() or "GEN"
            ),
            "assigned_students": count,
            "active_students": active_count,
            "inactive_students": inactive_count,
            "conversion_rate_pct": conversion_rate_pct,
            "total_mentee_solves": total_solves,
            "avg_solves_per_mentee": avg_solves,
            "max_capacity": 20,
            "is_allocated": bool(count > 0),
            "allocation_status": "ALLOCATED" if count > 0 else "UNALLOCATED",
            "workload_status": "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else "HIGH_WORKLOAD"),
            "students": students_summary
        })

    return {
        "total_faculty": len(faculty_list),
        "department_id": dept_id,
        "faculty_workload": workload
    }

# 4. DEDICATED REPORT DATA ENGINE 

def set_clean_excel_cell_value(cell, val, is_percentage=False):
    """
    Sets Excel cell values cleanly as native Python types (float, int, str)
    with proper openpyxl number_format so Excel NEVER displays green triangle warning indicators
    ('Number Stored as Text').
    """
    if val is None or str(val).strip() in ("", "—", "N/A", "None"):
        cell.value = str(val) if val is not None else ""
        return

    val_str = str(val).strip()

    if is_percentage or val_str.endswith("%"):
        clean_num_str = val_str.rstrip("%").strip()
        try:
            num = float(clean_num_str)
            cell.value = num / 100.0 if num > 1.0 or num == 0.0 else num
            cell.number_format = '0.0%'
            return
        except ValueError:
            pass

    if isinstance(val, bool):
        cell.value = val
        return

    if isinstance(val, (int, float)):
        cell.value = val
        if isinstance(val, float):
            cell.number_format = '0.0'
        else:
            cell.number_format = '#,##0'
        return

    if val_str.replace(".", "", 1).replace("-", "", 1).isdigit():
        try:
            if "." in val_str:
                cell.value = float(val_str)
                cell.number_format = '0.0'
            else:
                cell.value = int(val_str)
                cell.number_format = '#,##0'
            return
        except ValueError:
            pass

    cell.value = val_str


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
    ws.title = report_type[:31]

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
        col_span = 9
    elif report_type == "EXECUTIVE":
        col_span = 5

    # Setup Title Headers - Balanced, symmetrical executive header
    ws.row_dimensions[1].height = 36
    ws.row_dimensions[2].height = 22
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 10

    raw_title = data.get("report_title", "Nandha Executive Institutional Coding Health Report")
    # Clean main title for single-line elegant presentation
    if "(" in raw_title:
        main_title = raw_title.split("(")[0].strip()
    else:
        main_title = raw_title

    center_no_wrap = Alignment(horizontal="center", vertical="center", wrap_text=False)
    
    # 1. Main Title (Row 1, merged A1 to last column across full table width)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=col_span)
    cell = ws.cell(row=1, column=1, value=main_title)
    cell.font = title_font
    cell.alignment = center_no_wrap

    # 2. Subtitle Scope (Row 2, merged A2 to last column)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=col_span)
    cell = ws.cell(row=2, column=1, value=data.get("department_scope", "All Departments"))
    cell.font = subtitle_font
    cell.alignment = center_no_wrap

    # 3. Generated At Timestamp (Row 3, merged A3 to last column)
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=col_span)
    cell = ws.cell(row=3, column=1, value=f"Generated At: {data.get('generated_at', '')}")
    cell.font = cell_font
    cell.alignment = center_no_wrap

    # IMAGES (College emblem in top-left corner A1, 25-years anniversary logo in top-right corner)
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        logo1_path = os.path.join(base_dir, "assets", "nandha_emblem.png")
        if not os.path.exists(logo1_path):
            logo1_path = os.path.join(base_dir, "assets", "nandha_emblem_white_transparent.png")

        logo2_path = os.path.join(base_dir, "assets", "nec_25_years_logo_transparent.png")
        if not os.path.exists(logo2_path):
            logo2_path = os.path.join(base_dir, "assets", "nec_25_years_logo.png")
        
        if os.path.exists(logo1_path):
            img1 = ExcelImage(logo1_path)
            img1.width = 62
            img1.height = 50
            ws.add_image(img1, "A1")

        if os.path.exists(logo2_path):
            img2 = ExcelImage(logo2_path)
            img2.width = 50
            img2.height = 50
            right_col_letter = openpyxl.utils.get_column_letter(col_span)
            ws.add_image(img2, f"{right_col_letter}1")
    except Exception as e:
        print("Image error:", e)
        pass

    ws.append([]) # Empty row

    ws.append([]) # Empty row

    # DATA POPULATION
    if report_type == "EXECUTIVE":
        # Section 1: Executive KPI Overview
        kpi_banner = ws.cell(row=ws.max_row + 1, column=1, value="EXECUTIVE KEY PERFORMANCE INDICATORS")
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=5)
        for col_idx in range(1, 6):
            c = ws.cell(row=ws.max_row, column=col_idx)
            c.font = Font(name="Times New Roman", size=11.5, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center_align
            c.border = thin_border
        ws.row_dimensions[ws.max_row].height = 24

        metrics = data.get("summary_metrics", {})
        for k, v in metrics.items():
            ws.append([k, "", "", "", ""])
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
            left_cell = ws.cell(row=ws.max_row, column=1)
            left_cell.font = bold_cell_font
            left_cell.alignment = left_align
            
            val_cell = ws.cell(row=ws.max_row, column=5)
            val_cell.font = cell_font
            val_cell.alignment = center_align
            set_clean_excel_cell_value(val_cell, v)

            for c in range(1, 6):
                ws.cell(row=ws.max_row, column=c).border = thin_border
                if ws.max_row % 2 == 0:
                    ws.cell(row=ws.max_row, column=c).fill = alt_row_fill

        ws.append([]) # spacing

        # Section 2: Dimension Breakdown Table
        dim_banner = ws.cell(row=ws.max_row + 1, column=1, value="INSTITUTIONAL HEALTH DIMENSION BREAKDOWN")
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=5)
        for col_idx in range(1, 6):
            c = ws.cell(row=ws.max_row, column=col_idx)
            c.font = Font(name="Times New Roman", size=11.5, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center_align
            c.border = thin_border
        ws.row_dimensions[ws.max_row].height = 24

        # Table Header
        ws.append(["Evaluation Dimension & Weight Model", "", "", "", "Evaluated Score"])
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
        for col_idx in range(1, 6):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align if col_idx == 5 else left_align
            cell.border = thin_border
        ws.row_dimensions[ws.max_row].height = 22
            
        for row in data.get("dimension_breakdown", []):
            ws.append([row.get("dimension"), "", "", "", ""])
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=4)
            left_cell = ws.cell(row=ws.max_row, column=1)
            left_cell.font = cell_font
            left_cell.alignment = left_align
            
            val_cell = ws.cell(row=ws.max_row, column=5)
            val_cell.font = cell_font
            val_cell.alignment = center_align
            set_clean_excel_cell_value(val_cell, row.get("score"))

            for col_idx in range(1, 6):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.border = thin_border
                if ws.max_row % 2 == 0:
                    cell.fill = alt_row_fill

        # Section 3: Departmental Performance Matrix
        dept_benchmarks = data.get("department_benchmarks", [])
        if dept_benchmarks:
            ws.append([]) # spacing
            matrix_banner = ws.cell(row=ws.max_row + 1, column=1, value="DEPARTMENTAL PERFORMANCE MATRIX & BENCHMARKS")
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=5)
            for col_idx in range(1, 6):
                c = ws.cell(row=ws.max_row, column=col_idx)
                c.font = Font(name="Times New Roman", size=11.5, bold=True, color="FFFFFF")
                c.fill = header_fill
                c.alignment = center_align
                c.border = thin_border
            ws.row_dimensions[ws.max_row].height = 24

            headers = ["Department", "Total Students", "Active Solvers", "Participation %", "Health Index"]
            ws.append(headers)
            for col_idx in range(1, 6):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center_align
                cell.border = thin_border
            ws.row_dimensions[ws.max_row].height = 22

            for d_rec in dept_benchmarks:
                d_code = d_rec.get("department_code") or d_rec.get("department_name") or "DEPT"
                t_std = d_rec.get("student_count", 0)
                a_std = d_rec.get("active_count", 0)
                p_pct = d_rec.get('participation_rate_pct', 0)
                h_score = f"{d_rec.get('health_score', 0)}/100"
                
                ws.append([d_code, "", "", "", h_score])
                r_idx = ws.max_row
                for col_idx in range(1, 6):
                    cell = ws.cell(row=r_idx, column=col_idx)
                    cell.font = cell_font
                    cell.border = thin_border
                    cell.alignment = center_align
                    if r_idx % 2 == 0:
                        cell.fill = alt_row_fill

                set_clean_excel_cell_value(ws.cell(row=r_idx, column=1), d_code)
                set_clean_excel_cell_value(ws.cell(row=r_idx, column=2), t_std)
                set_clean_excel_cell_value(ws.cell(row=r_idx, column=3), a_std)
                set_clean_excel_cell_value(ws.cell(row=r_idx, column=4), p_pct, is_percentage=True)

    elif report_type == "FACULTY_ALLOCATION":
        # Section 1: Mentorship KPI Overview
        kpi_banner = ws.cell(row=ws.max_row + 1, column=1, value="FACULTY MENTORSHIP & WORKLOAD SUMMARY")
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=9)
        for col_idx in range(1, 10):
            c = ws.cell(row=ws.max_row, column=col_idx)
            c.font = Font(name="Times New Roman", size=11.5, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center_align
            c.border = thin_border
        ws.row_dimensions[ws.max_row].height = 24

        metrics = data.get("summary_metrics", {})
        for k, v in metrics.items():
            ws.append([k, "", "", "", "", "", "", "", ""])
            ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=8)
            left_cell = ws.cell(row=ws.max_row, column=1)
            left_cell.font = bold_cell_font
            left_cell.alignment = left_align
            
            val_cell = ws.cell(row=ws.max_row, column=9)
            val_cell.font = cell_font
            val_cell.alignment = center_align
            set_clean_excel_cell_value(val_cell, v)

            for c in range(1, 10):
                ws.cell(row=ws.max_row, column=c).border = thin_border
                if ws.max_row % 2 == 0:
                    ws.cell(row=ws.max_row, column=c).fill = alt_row_fill

        ws.append([]) # spacing

        # Section 2: Detailed Faculty Allocation Audit Table
        table_banner = ws.cell(row=ws.max_row + 1, column=1, value="DETAILED FACULTY MENTOR ALLOCATION AUDIT")
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=9)
        for col_idx in range(1, 10):
            c = ws.cell(row=ws.max_row, column=col_idx)
            c.font = Font(name="Times New Roman", size=11.5, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center_align
            c.border = thin_border
        ws.row_dimensions[ws.max_row].height = 24

        headers = ["Faculty Mentor", "Department", "Capacity Limit", "Assigned Mentees", "Active Solvers", "Inactive Mentees", "Active Conversion %", "Total Mentee Solves", "Ratio Status"]
        ws.append(headers)
        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border
        ws.row_dimensions[ws.max_row].height = 22

        for fac in data.get("faculty_records", []):
            ws.append([
                fac.get("faculty_name"),
                fac.get("department_code"),
                fac.get("max_capacity", 20),
                fac.get("assigned_students", 0),
                fac.get("active_students", 0),
                fac.get("inactive_students", 0),
                f"{fac.get('conversion_rate_pct', 0)}%",
                fac.get("total_mentee_solves", 0),
                fac.get("workload_status", "NORMAL")
            ])
            r_idx = ws.max_row
            for col_idx in range(1, 10):
                cell = ws.cell(row=r_idx, column=col_idx)
                cell.font = cell_font
                cell.border = thin_border
                if r_idx % 2 == 0:
                    cell.fill = alt_row_fill
                if col_idx > 2:
                    cell.alignment = center_align

            set_clean_excel_cell_value(ws.cell(row=r_idx, column=1), fac.get("faculty_name"))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=2), fac.get("department_code"))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=3), fac.get("max_capacity", 20))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=4), fac.get("assigned_students", 0))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=5), fac.get("active_students", 0))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=6), fac.get("inactive_students", 0))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=7), fac.get("conversion_rate_pct", 0), is_percentage=True)
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=8), fac.get("total_mentee_solves", 0))
            set_clean_excel_cell_value(ws.cell(row=r_idx, column=9), fac.get("workload_status", "NORMAL"))

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

    # Format Column Widths Generously to Guarantee Zero Text Truncation
    for col_idx_num, col in enumerate(ws.columns, 1):
        max_length = 0
        column = openpyxl.utils.get_column_letter(col_idx_num)
        for cell in col:
            try:
                if cell.row is not None and cell.row > 4 and cell.value:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
            except:
                pass
        
        # Enforce generous minimum widths for flawless layout
        if column == "A":
            max_length = max(max_length, 36)
        elif column in ["B", "C", "D", "E", "F", "G", "H", "I"]:
            max_length = max(max_length, 20)
            
        adjusted_width = (max_length + 4)
        ws.column_dimensions[column].width = adjusted_width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    # Dynamic filename construction based on input filters & IST timestamp
    clean_dept_slug = "".join(c for c in data.get("department_scope", "").split("•")[0].replace("Dept:", "") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    if not clean_dept_slug or clean_dept_slug == "All_Institutional_Departments":
        clean_dept_slug = "All_Departments"

    filter_slugs = [clean_dept_slug]
    if year_level and year_level != "ALL":
        filter_slugs.append(f"Yr{year_level}")
    if section and section != "ALL":
        filter_slugs.append(f"Sec{section}")
    if status_filter and status_filter != "ALL":
        filter_slugs.append(f"Status_{status_filter}")

    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    timestamp_slug = datetime.datetime.now(ist_tz).strftime("%Y%m%d_%H%M")
    report_name_slug = report_type.title().replace("_", "")
    
    dynamic_filename = f"NEC_{report_name_slug}_Report_{'_'.join(filter_slugs)}_{timestamp_slug}.xlsx"

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{dynamic_filename}"'}
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

    # HOD: respect multi-dept allocations and authorized departments
    if role_clean in ("hod", "department hod", "department_hod"):
        from backend.services.authorization_service import get_hod_authorized_department_ids
        hod_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if dept_id and dept_id in hod_dept_ids:
            eff_dept_id = dept_id
        elif hod_dept_ids:
            eff_dept_id = hod_dept_ids[0]
        else:
            eff_dept_id = getattr(current_user, "department_id", None)
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

    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(ist_tz)
    now_str = now_ist.strftime("%d %B %Y, %I:%M %p IST")

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
        faculty_recs = workload_res["faculty_workload"]
        tot_assigned = sum(f.get("assigned_students", 0) for f in faculty_recs)
        tot_active = sum(f.get("active_students", 0) for f in faculty_recs)
        tot_inactive = sum(f.get("inactive_students", 0) for f in faculty_recs)
        overall_conv = round((tot_active / tot_assigned * 100), 1) if tot_assigned > 0 else 0.0
        tot_solves = sum(f.get("total_mentee_solves", 0) for f in faculty_recs)
        opt_workload = sum(1 for f in faculty_recs if f.get("workload_status") in ("NORMAL", "AT_RATIO"))
        high_workload = sum(1 for f in faculty_recs if f.get("workload_status") == "HIGH_WORKLOAD")

        return {
            "report_title": "Faculty Mentorship & Student Allocation Audit Report",
            "generated_at": now_str,
            "department_scope": scope_summary_str,
            "total_faculty": workload_res["total_faculty"],
            "summary_metrics": {
                "Total Faculty Mentors": workload_res["total_faculty"],
                "Total Assigned Mentees": tot_assigned,
                "Active Solvers (Mentees)": tot_active,
                "Inactive Mentees": tot_inactive,
                "Active Conversion Rate": f"{overall_conv}%",
                "Total Mentees Solves": tot_solves,
                "Optimal Workload (<=20)": opt_workload,
                "High Workload (>20)": high_workload
            },
            "faculty_records": faculty_recs
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
    is_hod = "hod" in role_clean or "head of department" in role_clean or role_clean in ["department hod", "department_hod", "placement coordinator"]
    
    if is_hod:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        auth_dept_ids = get_hod_authorized_department_ids(db, current_user)
        if auth_dept_ids:
            depts = db.query(Department).filter(Department.id.in_(auth_dept_ids)).all()
        elif current_user.department_id:
            depts = db.query(Department).filter(Department.id == current_user.department_id).all()
        else:
            depts = []
    elif role_clean in ["staff", "faculty", "professor", "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor"]:
        if current_user.department_id:
            depts = db.query(Department).filter(Department.id == current_user.department_id).all()
        else:
            depts = []
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

    # Canonical HOD definitions for institution
    CANONICAL_HOD_MAP = {
        "IT": "Dr. M. Senthilkumar",
        "CSE(CS)": "Dr. S. Prabhu",
        "CSE(IOT)": "Dr. S. Karthikeyan",
        "CSE": "Dr. S. Prabhu",
    }
    EXCLUDE_HOD_ROLES = [
        "placement coordinator", "placement_coordinator", "placement officer", "placement_officer",
        "coordinator", "academic coordinator", "faculty", "staff", "student"
    ]

    # Pre-fetch direct HOD users (role must be HOD, not placement coordinator)
    direct_hods = db.query(User).filter(
        User.role.ilike("%HOD%"),
        ~func.lower(User.role).in_(EXCLUDE_HOD_ROLES),
        User.is_active == True,
        User.department_id.isnot(None)
    ).all()
    hod_by_dept = {h.department_id: h for h in direct_hods}

    # Also check HODDepartmentAllocation strictly for genuine HOD role users
    from backend.models import HODDepartmentAllocation
    hod_alloc_query = db.query(HODDepartmentAllocation.department_id, User).join(
        User, HODDepartmentAllocation.user_id == User.id
    ).filter(
        User.is_active == True,
        User.role.ilike("%HOD%"),
        ~func.lower(User.role).in_(EXCLUDE_HOD_ROLES)
    ).all()
    for dept_id, user in hod_alloc_query:
        if dept_id not in hod_by_dept:
            hod_by_dept[dept_id] = user

    STAFF_ROLES = [
        "Faculty", "faculty", "Staff", "staff", "Professor", "professor",
        "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor",
        "Placement Coordinator", "placement coordinator", "placement_coordinator",
        "Coordinator", "coordinator", "Academic Coordinator", "academic coordinator"
    ]
    faculty_counts_query = db.query(
        User.department_id, func.count(User.id)
    ).filter(
        or_(
            User.role.in_(STAFF_ROLES),
            User.role.ilike("%Faculty%"),
            User.role.ilike("%Staff%"),
            User.role.ilike("%Placement%"),
            User.role.ilike("%Coordinator%")
        ),
        ~func.lower(User.role).in_(["admin", "super admin", "super_admin", "administrator", "student"]),
        ~User.username.ilike("test_%"),
        ~User.username.ilike("dummy_%"),
        ~User.username.ilike("sec_test_%"),
        ~User.username.ilike("hardening_%"),
        ~User.username.ilike("%_p930"),
        User.is_active == True
    ).group_by(User.department_id).all()
    faculty_counts = {dept_id: count for dept_id, count in faculty_counts_query}

    # Pre-fetch total solved per department
    dept_solved_query = db.query(
        Student.department_id,
        func.coalesce(func.sum(LeetCodeProfileStats.total_solved), 0),
        func.sum(case((LeetCodeProfileStats.total_solved > 0, 1), else_=0))
    ).join(
        LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
    ).filter(Student.is_active == True).group_by(Student.department_id).all()
    dept_solved_map = {dept_id: (int(tot or 0), int(act or 0)) for dept_id, tot, act in dept_solved_query}

    result = []
    for d in depts:
        if d.code and "TEST" in d.code.upper():
            continue
        
        count = dept_counts.get(d.id, 0)
        if count == 0:
            continue
        name = "Information Technology" if (d.code and d.code.upper() == "IT") else d.name
        
        hod_user = hod_by_dept.get(d.id)
        hod_display_name = None
        if hod_user and (hod_user.full_name or hod_user.username):
            raw_name = hod_user.full_name or hod_user.username
            # Guard against coordinators accidentally linked
            if not any(coord.lower() in raw_name.lower() for coord in ["Santhoshkumar", "Devayani", "Sivakumar"]):
                hod_display_name = raw_name
        
        if not hod_display_name:
            code_clean = (d.code or "").upper().strip()
            hod_display_name = CANONICAL_HOD_MAP.get(code_clean, f"HOD ({d.code})")

        fac_count = faculty_counts.get(d.id, 0)
        tot_solved, act_count = dept_solved_map.get(d.id, (0, 0))
        comp_rate = round((act_count / count) * 100.0, 1) if count > 0 else 0.0

        result.append({
            "id": d.id,
            "name": name,
            "code": d.code,
            "student_count": count,
            "faculty_count": fac_count,
            "hod_name": hod_display_name,
            "hod_email": hod_user.email if hod_user else None,
            "total_solved": tot_solved,
            "completion_rate": comp_rate
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
    from backend.models import Student, LeetCodeProfileStats, StudentRiskProfile, HODDepartmentAllocation
    
    dept = db.query(Department).filter(Department.id == dept_id).first()
    
    # 1. HOD Details - strictly genuine HOD, never Placement Coordinator
    EXCLUDE_HOD_ROLES = [
        "placement coordinator", "placement_coordinator", "placement officer", "placement_officer",
        "coordinator", "academic coordinator", "faculty", "staff", "student"
    ]
    CANONICAL_HOD_MAP = {
        "IT": "Dr. M. Senthilkumar",
        "CSE(CS)": "Dr. S. Prabhu",
        "CSE(IOT)": "Dr. S. Karthikeyan",
        "CSE": "Dr. S. Prabhu",
    }
    
    # Check direct HOD first
    hod_user = db.query(User).filter(
        User.department_id == dept_id,
        User.role.ilike("%HOD%"),
        ~func.lower(User.role).in_(EXCLUDE_HOD_ROLES),
        User.is_active == True
    ).first()

    if not hod_user:
        hod_user = db.query(User).join(
            HODDepartmentAllocation, HODDepartmentAllocation.user_id == User.id
        ).filter(
            HODDepartmentAllocation.department_id == dept_id,
            User.role.ilike("%HOD%"),
            ~func.lower(User.role).in_(EXCLUDE_HOD_ROLES),
            User.is_active == True
        ).first()

    code_clean = (dept.code or "").upper().strip() if dept else ""
    canonical_fallback = CANONICAL_HOD_MAP.get(code_clean, f"HOD - {dept.code}" if dept else "Head of Department")

    resolved_hod_name = None
    if hod_user and (hod_user.full_name or hod_user.username):
        raw_name = hod_user.full_name or hod_user.username
        if not any(coord.lower() in raw_name.lower() for coord in ["Santhoshkumar", "Devayani", "Sivakumar"]):
            resolved_hod_name = raw_name

    hod_name_out = resolved_hod_name or canonical_fallback

    hod_info = {
        "id": hod_user.id if hod_user else None,
        "name": hod_name_out,
        "username": hod_user.username if hod_user else "HOD",
        "email": hod_user.email if hod_user else "hod@nandha.edu.in",
        "role": hod_user.role if (hod_user and "hod" in (hod_user.role or "").lower()) else "Department HOD"
    }

    # 2. Staff List & Workload Completion
    STAFF_ROLES = [
        "Faculty", "faculty", "Staff", "staff", "Professor", "professor",
        "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor",
        "Placement Coordinator", "placement coordinator", "placement_coordinator",
        "Coordinator", "coordinator", "Academic Coordinator", "academic coordinator"
    ]
    staff_users = db.query(User).filter(
        User.department_id == dept_id,
        or_(
            User.role.in_(STAFF_ROLES),
            User.role.ilike("%Faculty%"),
            User.role.ilike("%Staff%"),
            User.role.ilike("%Placement%"),
            User.role.ilike("%Coordinator%")
        ),
        ~func.lower(User.role).in_(["admin", "super admin", "super_admin", "administrator", "student"]),
        ~User.username.ilike("test_%"),
        ~User.username.ilike("dummy_%"),
        ~User.username.ilike("sec_test_%"),
        ~User.username.ilike("hardening_%"),
        ~User.username.ilike("%_p930"),
        User.is_active == True
    ).all()

    # Pre-fetch all assignments for this department's students
    assignments = db.query(FacultyStudentAssignment, Student, LeetCodeProfileStats).join(
        Student, FacultyStudentAssignment.student_id == Student.id
    ).outerjoin(
        LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
    ).filter(
        Student.department_id == dept_id,
        FacultyStudentAssignment.is_active == True,
        Student.is_active == True
    ).all()

    staff_student_map = {}
    for assign, s, stats in assignments:
        fid = assign.faculty_id
        if fid not in staff_student_map:
            staff_student_map[fid] = []
        staff_student_map[fid].append((s, stats))

    staff_list_out = []
    all_faculty_ids = set(u.id for u in staff_users).union(set(staff_student_map.keys()))
    all_fac_users = {u.id: u for u in staff_users}
    missing_fids = [fid for fid in all_faculty_ids if fid not in all_fac_users]
    if missing_fids:
        extra_users = db.query(User).filter(User.id.in_(missing_fids), User.is_active == True).all()
        for eu in extra_users:
            all_fac_users[eu.id] = eu

    for fid, u in all_fac_users.items():
        pairs = staff_student_map.get(fid, [])
        assigned_cnt = len(pairs)
        active_cnt = sum(1 for s, st in pairs if (st and (st.total_solved or 0) > 0))
        completed_cnt = sum(1 for s, st in pairs if (st and (st.total_solved or 0) >= 10))
        tot_solved = sum((st.total_solved or 0) for s, st in pairs if st)
        avg_solved = round(tot_solved / assigned_cnt, 1) if assigned_cnt > 0 else 0.0
        comp_rate = round((active_cnt / assigned_cnt) * 100.0, 1) if assigned_cnt > 0 else 0.0

        st_sample = []
        for s, st in pairs[:25]:
            st_sample.append({
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "year_level": s.year_level,
                "total_solved": st.total_solved if st else 0,
                "contest_rating": round(float(st.contest_rating), 1) if (st and st.contest_rating) else 0.0
            })

        staff_list_out.append({
            "id": u.id,
            "name": u.full_name or u.username,
            "username": u.username,
            "email": u.email,
            "assigned_count": assigned_cnt,
            "active_students": active_cnt,
            "completed_students": completed_cnt,
            "completion_rate": comp_rate,
            "total_solved": tot_solved,
            "avg_solved": avg_solved,
            "students": st_sample
        })

    staff_list_out.sort(key=lambda x: (x["assigned_count"], x["completion_rate"]), reverse=True)

    # 3. Top Performers (Top 10 by total_solved)
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
        
    # 4. At-Risk Students
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
        "department": {
            "id": dept.id if dept else dept_id,
            "name": dept.name if dept else "Department",
            "code": dept.code if dept else "DEPT",
            "total_students": len(performers),
            "total_staff": len(staff_list_out)
        },
        "hod": hod_info,
        "staff_list": staff_list_out,
        "top_performers": performers,
        "at_risk_students": at_risk
    }

