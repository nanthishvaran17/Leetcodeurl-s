"""
history.py
================================================================================
REAL-TIME GROWTH & DELTA ENGINE + TIME MACHINE HISTORY API
================================================================================
Provides high-performance, accurate endpoints for:
- /api/growth/college-delta: Aggregate college/department/year problem solve growth & difficulty velocity.
- /api/growth/improvers: Top growth improvers leaderboard over custom timeframe windows (today, 7d, 30d, all).
- /api/growth/options: Dynamic filter options for departments and academic years.
- /api/history/{student_identifier}: Granular historical stat snapshots and Time Machine progression timeline.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any, cast
import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, User
from backend.schemas import StudentStatSnapshotOut, ImproverOut
from backend.security import get_current_user_optional
from backend.services.authorization_service import apply_role_based_student_filter

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

IST_TZ = ZoneInfo("Asia/Kolkata")
UTC_TZ = datetime.timezone.utc

def _growth_cutoff(period: str) -> datetime.datetime:
    now_ist = datetime.datetime.now(IST_TZ)
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == "today":
        return start_of_today_ist.astimezone(UTC_TZ)
    if period == "7d":
        start_of_7d = start_of_today_ist - datetime.timedelta(days=6)
        return start_of_7d.astimezone(UTC_TZ)
    if period == "30d":
        start_of_30d = start_of_today_ist - datetime.timedelta(days=29)
        return start_of_30d.astimezone(UTC_TZ)
    return datetime.datetime(2020, 1, 1, tzinfo=UTC_TZ)


def _filtered_growth_students(
    db: Session, 
    dept: Optional[str], 
    dept_id: Optional[int], 
    year: Optional[str], 
    year_level: Optional[str],
    current_user: Optional[User] = None
) -> List[Student]:
    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    effective_dept = (dept or "").strip()
    effective_year = (year or year_level or "").strip()
    
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    elif effective_dept.upper() not in ("", "ALL", "ALL DEPARTMENTS"):
        query = query.join(Student.department).filter(
            func.upper(Department.code) == effective_dept.upper()
        )
    if effective_year.upper() not in ("", "ALL", "ALL YEARS", "ALL ACADEMIC YEARS"):
        clean_y = effective_year.upper().replace(" YEAR", "").strip()
        valid_matches = [clean_y, f"{clean_y} YEAR"]
        if clean_y in ("I", "1", "1ST"):
            valid_matches += ["I", "1", "1ST", "1ST YEAR", "I YEAR"]
        elif clean_y in ("II", "2", "2ND"):
            valid_matches += ["II", "2", "2ND", "2ND YEAR", "II YEAR"]
        elif clean_y in ("III", "3", "3RD"):
            valid_matches += ["III", "3", "3RD", "3RD YEAR", "III YEAR"]
        elif clean_y in ("IV", "4", "4TH"):
            valid_matches += ["IV", "4", "4TH", "4TH YEAR", "IV YEAR"]
        valid_matches = list(set(valid_matches))
        query = query.filter(func.upper(Student.year_level).in_(valid_matches))
        
    if current_user:
        query = apply_role_based_student_filter(query, current_user, db)
        
    return query.all()


MAX_BASELINE_STALENESS = {
    "today": datetime.timedelta(hours=36),
    "7d": datetime.timedelta(hours=48),
    "30d": datetime.timedelta(hours=72)
}

MAX_CURRENT_AGE = datetime.timedelta(hours=48)

def _clean_snaps(snaps: List[StudentStatSnapshot]) -> List[StudentStatSnapshot]:
    """Keep only consistent, non-regressing, real snapshots."""
    out, run_max = [], 0
    for sn in snaps:
        if getattr(sn, "source", None) in ("on_demand", "unverified"):
            continue
        ez, md, hd = sn.easy_solved or 0, sn.medium_solved or 0, sn.hard_solved or 0
        tot = sn.total_solved or 0
        if tot != ez + md + hd:  # inconsistent
            continue
        if tot < run_max:  # regression = bad fetch
            continue
        run_max = tot
        out.append(sn)
    return out


def _derived_growth(db: Session, students: List[Student], cutoff: Optional[datetime.datetime], period: str = "7d", now_utc: Optional[datetime.datetime] = None) -> Dict[int, Dict[str, Any]]:
    if not students:
        return {}
    
    if now_utc is None:
        now_utc = datetime.datetime.now(UTC_TZ)
    elif now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=UTC_TZ)
    
    student_ids = [getattr(s, "id") for s in students]
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids),
        (StudentStatSnapshot.source != 'unverified') | (StudentStatSnapshot.source.is_(None))
    ).order_by(StudentStatSnapshot.student_id.asc(), StudentStatSnapshot.captured_at.asc()).all()
    
    grouped: Dict[int, List[StudentStatSnapshot]] = defaultdict(list)
    for snap in snapshots:
        grouped[getattr(snap, "student_id")].append(snap)

    growth: Dict[int, Dict[str, Any]] = {}
    
    for s in students:
        s_id = getattr(s, "id")
        snaps = _clean_snaps(grouped.get(s_id, []))
        st = s.stats
        
        # Determine Current State from live stats or latest snapshot
        cur_ez = (st.easy_solved or 0) if st else 0
        cur_med = (st.medium_solved or 0) if st else 0
        cur_hd = (st.hard_solved or 0) if st else 0
        cur_tot = max(st.total_solved or 0 if st else 0, cur_ez + cur_med + cur_hd)
        cur_rat = st.contest_rating if st else None
        
        if st and st.total_solved is not None:
            c_at = st.last_verified_at or st.last_updated or now_utc
            if c_at and c_at.tzinfo is None:
                c_at = c_at.replace(tzinfo=UTC_TZ)
            current_dict = {
                "captured_at": c_at.isoformat() if c_at else None,
                "source": st.source or "live_stats",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat
            }
        elif snaps:
            c_snap = snaps[-1]
            cur_ez = c_snap.easy_solved or 0
            cur_med = c_snap.medium_solved or 0
            cur_hd = c_snap.hard_solved or 0
            cur_tot = max(c_snap.total_solved or 0, cur_ez + cur_med + cur_hd)
            cur_rat = c_snap.contest_rating
            current_dict = _serialize_snap(c_snap)
        else:
            growth[s_id] = {
                "growth_status": "UNKNOWN",
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "NO_SNAPSHOTS",
                "baseline": None,
                "current": None
            }
            continue

        if period == "all":
            growth[s_id] = {
                "period": "all",
                "growth_status": "VERIFIED",
                "current_status": "VERIFIED",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat,
                "site_rank": getattr(st, "public_profile_ranking", None) if st else None,
                "contest_rank": getattr(st, "contest_global_ranking", None) if st else None,
                "global_rank": getattr(st, "public_profile_ranking", None) if st else None,
                "captured_at": current_dict.get("captured_at") if current_dict else None,
                "source": current_dict.get("source") if current_dict else None
            }
            continue

        baseline_snap: Optional[StudentStatSnapshot] = None
        if cutoff is not None:
            for snap in snaps:
                c_at = snap.captured_at
                if c_at.tzinfo is None:
                    c_at = c_at.replace(tzinfo=UTC_TZ)
                if c_at <= cutoff:
                    baseline_snap = snap
                else:
                    break

        # No baseline, or baseline too old -> UNKNOWN (never fallback to 0 / snaps[0])
        stale = False
        if baseline_snap is not None:
            b_at = baseline_snap.captured_at
            if b_at.tzinfo is None:
                b_at = b_at.replace(tzinfo=UTC_TZ)
            stale = (cutoff - b_at) > MAX_BASELINE_STALENESS.get(period, datetime.timedelta(hours=48))

        if baseline_snap is None or stale:
            growth[s_id] = {
                "growth_status": "UNKNOWN",
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "NO_FRESH_BASELINE",
                "baseline": _serialize_snap(baseline_snap),
                "current": current_dict
            }
            continue

        baseline_dict = _serialize_snap(baseline_snap)
        b_ez = baseline_snap.easy_solved or 0
        b_med = baseline_snap.medium_solved or 0
        b_hd = baseline_snap.hard_solved or 0
        b_tot = b_ez + b_med + b_hd
        b_rat = baseline_snap.contest_rating

        # Live went DOWN vs baseline -> conflict, don't clamp silently
        if cur_ez < b_ez or cur_med < b_med or cur_hd < b_hd:
            growth[s_id] = {
                "growth_status": "CONFLICT",
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "LIVE_BELOW_BASELINE",
                "baseline": baseline_dict,
                "current": current_dict
            }
            continue

        d_ez = cur_ez - b_ez
        d_med = cur_med - b_med
        d_hd = cur_hd - b_hd
        d_tot = d_ez + d_med + d_hd  # total ALWAYS = sum

        d_rat = None
        if cur_rat is not None and b_rat is not None:
            d_rat = round(float(cur_rat) - float(b_rat), 1)

        growth[s_id] = {
            "growth_status": "VERIFIED",
            "delta_total": d_tot,
            "delta_easy": d_ez,
            "delta_medium": d_med,
            "delta_hard": d_hd,
            "delta_rating": d_rat,
            "conflict_reason": None,
            "baseline": baseline_dict,
            "current": current_dict
        }

    return growth

def _serialize_snap(snap: Optional[StudentStatSnapshot]) -> Optional[Dict[str, Any]]:
    if not snap:
        return None
    c_at = snap.captured_at
    if c_at and c_at.tzinfo is None:
        c_at = c_at.replace(tzinfo=UTC_TZ)
    return {
        "captured_at": c_at.isoformat() if c_at else None,
        "source": snap.source,
        "total_solved": snap.total_solved,
        "easy_solved": snap.easy_solved,
        "medium_solved": snap.medium_solved,
        "hard_solved": snap.hard_solved,
        "contest_rating": snap.contest_rating
    }

def _conflict(baseline: StudentStatSnapshot, current: StudentStatSnapshot, reason: str) -> Dict[str, Any]:
    return {
        "growth_status": "CONFLICT",
        "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
        "conflict_reason": reason,
        "baseline": _serialize_snap(baseline),
        "current": _serialize_snap(current)
    }

@router.get("/history/{student_identifier}")
def get_student_history(
    student_identifier: str,
    limit: int = Query(50, ge=1, le=500),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns time-series historical snapshots for a specific student by ID, register number, username, or name.
    """
    student = None
    clean_id = student_identifier.strip()
    
    if clean_id.isdigit():
        student = db.query(Student).filter(Student.id == int(clean_id)).first()
    
    if not student:
        student = db.query(Student).filter(
            (Student.reg_no.ilike(clean_id)) |
            (Student.username.ilike(clean_id)) |
            (Student.name.ilike(f"%{clean_id}%"))
        ).first()

    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{clean_id}' not found.")
    query = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id == student.id,
        (StudentStatSnapshot.source != 'unverified') | (StudentStatSnapshot.source.is_(None))
    )

    if from_date:
        try:
            fd = datetime.datetime.fromisoformat(from_date)
            query = query.filter(StudentStatSnapshot.captured_at >= fd)
        except ValueError:
            pass

    if to_date:
        try:
            td = datetime.datetime.fromisoformat(to_date)
            query = query.filter(StudentStatSnapshot.captured_at <= td)
        except ValueError:
            pass

    effective_limit = limit if isinstance(limit, int) else 50
    snapshots = query.order_by(StudentStatSnapshot.captured_at.desc()).limit(effective_limit).all()
    
    ui_snapshots = []
    
    # If no snapshots exist in DB, dynamically create baseline snapshot on-the-fly
    if not snapshots and student.stats:
        st = student.stats
        now = datetime.datetime.now(UTC_TZ)
        snap = StudentStatSnapshot(
            student_id=student.id,
            total_solved=st.total_solved or 0,
            easy_solved=st.easy_solved or 0,
            medium_solved=st.medium_solved or 0,
            hard_solved=st.hard_solved or 0,
            contest_rating=st.contest_rating,
            global_rank=st.public_profile_ranking,
            contest_global_ranking=st.contest_global_ranking,
            delta_total=None,
            delta_easy=None,
            delta_medium=None,
            delta_hard=None,
            delta_rating=None,
            captured_at=now,
            sync_run_id="SYNC-ON-DEMAND",
            source="on_demand",
            is_verified=False
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)
        ui_snapshots = [snap]

    growth_available = len(snapshots) >= 2
    if len(snapshots) == 1:
        # Only one eligible snapshot exists
        s0 = cast(Any, snapshots[0])
        s0.delta_total = None
        s0.delta_easy = None
        s0.delta_medium = None
        s0.delta_hard = None
        s0.delta_rating = None
    elif len(snapshots) >= 2:
        # Calculate dynamic deltas between adjacent time series points
        for i in range(len(snapshots)):
            s_curr = cast(Any, snapshots[i])
            if i < len(snapshots) - 1:
                s_prev = cast(Any, snapshots[i + 1])
                
                # Check for reconciliation
                c_ez = s_curr.easy_solved or 0
                c_med = s_curr.medium_solved or 0
                c_hd = s_curr.hard_solved or 0
                c_tot = s_curr.total_solved or 0
                
                p_ez = s_prev.easy_solved or 0
                p_med = s_prev.medium_solved or 0
                p_hd = s_prev.hard_solved or 0
                p_tot = s_prev.total_solved or 0
                
                if (c_tot != (c_ez + c_med + c_hd)) or (p_tot != (p_ez + p_med + p_hd)):
                    s_curr.delta_total = None
                    s_curr.delta_easy = None
                    s_curr.delta_medium = None
                    s_curr.delta_hard = None
                    s_curr.delta_rating = None
                else:
                    d_ez = c_ez - p_ez
                    d_med = c_med - p_med
                    d_hd = c_hd - p_hd
                    s_curr.delta_easy = d_ez
                    s_curr.delta_medium = d_med
                    s_curr.delta_hard = d_hd
                    s_curr.delta_total = d_ez + d_med + d_hd
                    
                    if s_curr.contest_rating is not None and s_prev.contest_rating is not None:
                        s_curr.delta_rating = round(float(s_curr.contest_rating) - float(s_prev.contest_rating), 1)
                    else:
                        s_curr.delta_rating = None
            else:
                s_curr.delta_total = None
                s_curr.delta_easy = None
                s_curr.delta_medium = None
                s_curr.delta_hard = None
                s_curr.delta_rating = None

    # Return enriched response containing student info + snapshots
    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "reg_no": student.reg_no,
            "username": student.username,
            "profile_url": f"https://leetcode.com/u/{student.username}/" if student.username else None,
            "department": student.department.code if student.department else "CSE",
            "year": student.year_level,
            "total_solved": (student.stats.total_solved or 0) if student.stats else 0,
            "easy_solved": (student.stats.easy_solved or 0) if student.stats else 0,
            "medium_solved": (student.stats.medium_solved or 0) if student.stats else 0,
            "hard_solved": (student.stats.hard_solved or 0) if student.stats else 0,
            "contest_rating": student.stats.contest_rating if student.stats else None
        },
        "growth_available": growth_available,
        "snapshots": [StudentStatSnapshotOut.model_validate(s) for s in snapshots],
        "ui_snapshots": [StudentStatSnapshotOut.model_validate(s) for s in ui_snapshots]
    }


@router.get("/growth/improvers", response_model=List[ImproverOut])
def get_top_improvers(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns top problem solving improvers (biggest delta) over specified period.
    Supports filtering by department code/id and academic year.
    """
    cutoff = _growth_cutoff(period)
    students = _filtered_growth_students(db, dept, dept_id, year, year_level, current_user=current_user)
    growth = _derived_growth(db, students, cutoff, period=period)
    
    results = []
    for student in students:
        values = growth.get(getattr(student, "id"), {"growth_status": "UNKNOWN", "total": None, "easy": None, "medium": None, "hard": None, "rating": None})
        if values.get("growth_status") != "VERIFIED":
            continue
        results.append((student, values))

    def _safe_neg(val):
        return -val if val is not None else float('inf')
        
    results.sort(key=lambda item: (
        _safe_neg(item[1].get("delta_total")),
        _safe_neg(item[1].get("delta_hard")),
        _safe_neg(item[1].get("delta_medium")),
        _safe_neg(item[1].get("delta_easy")),
        _safe_neg(item[1].get("delta_rating")),
        -((item[0].stats.total_solved or 0) if item[0].stats else 0),
        item[0].name.lower(),
        item[0].id
    ))
    results = results[:limit]

    improvers = []
    for st, values in results:
        dept_code = st.department.code if st.department else "CSE"
        sec_name = st.section.name if st.section else "A"
        cur_solved = (
            (st.stats.easy_solved or 0) +
            (st.stats.medium_solved or 0) +
            (st.stats.hard_solved or 0)
        ) if st.stats else 0
        cur_rating = st.stats.contest_rating if st.stats else None

        improvers.append(ImproverOut(
            student_id=st.id,
            reg_no=st.reg_no,
            name=st.name,
            department_code=dept_code,
            year_level=st.year_level,
            section_name=sec_name,
            total_solved=cur_solved,
            easy_solved=st.stats.easy_solved or 0 if st.stats else 0,
            medium_solved=st.stats.medium_solved or 0 if st.stats else 0,
            hard_solved=st.stats.hard_solved or 0 if st.stats else 0,
            delta_solved=values.get("delta_total") if period != "all" else None,
            delta_easy=values.get("delta_easy") if period != "all" else None,
            delta_medium=values.get("delta_medium") if period != "all" else None,
            delta_hard=values.get("delta_hard") if period != "all" else None,
            delta_rating=values.get("delta_rating") if period != "all" else None,
            growth_status=values.get("growth_status") if period != "all" else None,
            current_status=values.get("current_status"),
            conflict_reason=values.get("conflict_reason"),
            baseline=values.get("baseline"),
            current=values.get("current"),
            current_contest_rating=cur_rating
        ))

    return improvers


@router.get("/growth/options")
def get_growth_options(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    """Return filter values from the active student records."""
    departments_query = db.query(Department.id, Department.code, Department.name).join(
        Student, Student.department_id == Department.id
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    
    from backend.services.authorization_service import _STAFF_ROLES, _HOD_ROLES, _normalize_role
    role_clean = _normalize_role(current_user)
    if current_user and role_clean in _STAFF_ROLES:
        from backend.services.faculty_assignment_service import FacultyAssignmentService
        assigned_ids = FacultyAssignmentService.get_faculty_assigned_student_ids(db, int(cast(Any, current_user).id))
        if assigned_ids:
            departments_query = departments_query.filter(Student.id.in_(assigned_ids))
        else:
            departments_query = departments_query.filter(Student.id == -1)
    elif current_user and role_clean in _HOD_ROLES:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        dept_ids = get_hod_authorized_department_ids(db, current_user)
        if dept_ids:
            departments_query = departments_query.filter(Department.id.in_(dept_ids))
        elif current_user.department_id:
            departments_query = departments_query.filter(Department.id == current_user.department_id)
        
    departments = departments_query.distinct().order_by(Department.name.asc()).all()
    
    valid_depts = [
        {"id": department_id, "code": code, "name": name}
        for department_id, code, name in departments
        if not (
            (code or "").upper().strip() == "CSE" or
            (code or "").upper().startswith("TEST") or 
            "_TEST" in (code or "").upper() or 
            "-TEST" in (code or "").upper() or
            "TEST" in (name or "").upper() or
            "DEMO" in (code or "").upper()
        )
    ]
    
    return {
        "departments": valid_depts,
        "years": ["I", "II", "III", "IV"]
    }


@router.get("/growth/college-delta")
def get_college_delta(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns aggregate college problem solved growth and difficulty breakdown over period,
    with support for department and academic year filters.
    """
    cutoff = _growth_cutoff(period)
    student_rows = _filtered_growth_students(db, dept, dept_id, year, year_level, current_user=current_user)
    growth = _derived_growth(db, student_rows, cutoff, period=period)
    
    verified_growth = [values for values in growth.values() if values.get("growth_status") == "VERIFIED"]
    
    period_totals = {
        key: sum((values.get(f"delta_{key}") or 0) for values in verified_growth)
        for key in ("total", "easy", "medium", "hard")
    }
    
    verified_students = len(verified_growth)
    unknown_students = sum(1 for values in growth.values() if values.get("growth_status") == "UNKNOWN")
    conflict_students = sum(1 for values in growth.values() if values.get("growth_status") == "CONFLICT")
    
    current_total = sum(
        ((student.stats.easy_solved or 0) + (student.stats.medium_solved or 0) + (student.stats.hard_solved or 0))
        if student.stats else 0
        for student in student_rows
    )
    current_easy = sum((student.stats.easy_solved or 0) for student in student_rows if student.stats)
    current_medium = sum((student.stats.medium_solved or 0) for student in student_rows if student.stats)
    current_hard = sum((student.stats.hard_solved or 0) for student in student_rows if student.stats)
    
    active_students = sum(1 for student in student_rows if (
        student.stats and ((student.stats.total_solved or 0) > 0 or (student.stats.easy_solved or 0) + (student.stats.medium_solved or 0) + (student.stats.hard_solved or 0) > 0)
    ))
    
    if period == "all":
        selected_total, selected_easy, selected_medium, selected_hard = current_total, current_easy, current_medium, current_hard
    else:
        selected_total = period_totals["total"]
        selected_easy = period_totals["easy"]
        selected_medium = period_totals["medium"]
        selected_hard = period_totals["hard"]

    return {
        "period": period,
        "delta_total": period_totals["total"],
        "delta_easy": period_totals["easy"],
        "delta_medium": period_totals["medium"],
        "delta_hard": period_totals["hard"],
        "total_students": len(student_rows),
        "verified_students": verified_students,
        "unknown_students": unknown_students,
        "conflict_students": conflict_students,
        "active_students": active_students,
        "active_solvers": active_students,
        "total_solved": selected_total,
        "easy_solved": selected_easy,
        "medium_solved": selected_medium,
        "hard_solved": selected_hard,
        "growth": period_totals["total"]
    }
