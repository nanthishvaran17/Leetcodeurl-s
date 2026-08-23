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
from typing import List, Optional, Dict, Any
import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, LeetCodeProfileStats, WeeklyPublicResult
from backend.schemas import StudentStatSnapshotOut, ImproverOut

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

IST_TZ = ZoneInfo("Asia/Kolkata")
UTC_TZ = datetime.timezone.utc

def _growth_cutoff(period: str) -> datetime.datetime:
    now_utc = datetime.datetime.now(UTC_TZ)
    if period == "today":
        now_ist = datetime.datetime.now(IST_TZ)
        start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_today_ist.astimezone(UTC_TZ)
    if period == "7d":
        return now_utc - datetime.timedelta(days=7)
    if period == "30d":
        return now_utc - datetime.timedelta(days=30)
    return datetime.datetime(2020, 1, 1, tzinfo=UTC_TZ)


def _filtered_growth_students(
    db: Session, 
    dept: Optional[str], 
    dept_id: Optional[int], 
    year: Optional[str], 
    year_level: Optional[str]
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
        query = query.filter(func.upper(Student.year_level) == effective_year.upper().replace(" YEAR", ""))
    return query.all()


def _derived_growth(db: Session, students: List[Student], cutoff: datetime.datetime, period: str = "7d") -> Dict[int, Dict[str, Any]]:
    if not students:
        return {}
    
    student_ids = [s.id for s in students]
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids)
    ).order_by(StudentStatSnapshot.student_id.asc(), StudentStatSnapshot.captured_at.asc()).all()
    
    grouped: Dict[int, List[StudentStatSnapshot]] = defaultdict(list)
    for snap in snapshots:
        grouped[snap.student_id].append(snap)

    growth: Dict[int, Dict[str, Any]] = {}
    
    for s in students:
        s_id = s.id
        cur_stats = s.stats
        
        cur_tot = (cur_stats.total_solved or 0) if cur_stats else 0
        cur_easy = (cur_stats.easy_solved or 0) if cur_stats else 0
        cur_med = (cur_stats.medium_solved or 0) if cur_stats else 0
        cur_hard = (cur_stats.hard_solved or 0) if cur_stats else 0
        cur_rat = (cur_stats.contest_rating or 1500.0) if cur_stats else 1500.0

        snaps = grouped.get(s_id, [])
        
        if not snaps:
            # Baseline from single current stats
            growth[s_id] = {
                "total": cur_tot if period == "all" else 0,
                "easy": cur_easy if period == "all" else 0,
                "medium": cur_med if period == "all" else 0,
                "hard": cur_hard if period == "all" else 0,
                "rating": 0.0
            }
            continue

        if period == "all":
            growth[s_id] = {
                "total": cur_tot,
                "easy": cur_easy,
                "medium": cur_med,
                "hard": cur_hard,
                "rating": cur_rat
            }
            continue

        # Find baseline snapshot at or closest before cutoff
        # Ensure cutoff is timezone-aware
        baseline_snap: Optional[StudentStatSnapshot] = None
        for snap in snaps:
            c_at = snap.captured_at
            if c_at.tzinfo is None:
                c_at = c_at.replace(tzinfo=UTC_TZ)
            if c_at <= cutoff:
                baseline_snap = snap
            else:
                break
        
        # If no snapshot existed before cutoff, take the earliest snapshot available
        if baseline_snap is None and snaps:
            baseline_snap = snaps[0]

        latest_snap = snaps[-1]

        # Delta calculation between latest and baseline
        b_tot = baseline_snap.total_solved or 0
        b_easy = baseline_snap.easy_solved or 0
        b_med = baseline_snap.medium_solved or 0
        b_hard = baseline_snap.hard_solved or 0
        b_rat = baseline_snap.contest_rating or cur_rat

        l_tot = latest_snap.total_solved or cur_tot
        l_easy = latest_snap.easy_solved or cur_easy
        l_med = latest_snap.medium_solved or cur_med
        l_hard = latest_snap.hard_solved or cur_hard
        l_rat = latest_snap.contest_rating or cur_rat

        d_tot = max(0, l_tot - b_tot)
        d_easy = max(0, l_easy - b_easy)
        d_med = max(0, l_med - b_med)
        d_hard = max(0, l_hard - b_hard)
        d_rat = round(l_rat - b_rat, 1)

        # In case delta is 0 but snapshots indicate interim progress
        if d_tot == 0 and len(snaps) > 1 and period in ("7d", "30d"):
            d_tot = sum(max(0, (snaps[i].total_solved or 0) - (snaps[i-1].total_solved or 0)) for i in range(1, len(snaps)))
            d_easy = sum(max(0, (snaps[i].easy_solved or 0) - (snaps[i-1].easy_solved or 0)) for i in range(1, len(snaps)))
            d_med = sum(max(0, (snaps[i].medium_solved or 0) - (snaps[i-1].medium_solved or 0)) for i in range(1, len(snaps)))
            d_hard = sum(max(0, (snaps[i].hard_solved or 0) - (snaps[i-1].hard_solved or 0)) for i in range(1, len(snaps)))

        growth[s_id] = {
            "total": d_tot,
            "easy": d_easy,
            "medium": d_med,
            "hard": d_hard,
            "rating": d_rat
        }

    return growth


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

    query = db.query(StudentStatSnapshot).filter(StudentStatSnapshot.student_id == student.id)

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

    snapshots = query.order_by(StudentStatSnapshot.captured_at.desc()).limit(limit).all()
    
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
            contest_rating=st.contest_rating or 1500.0,
            global_rank=st.public_profile_ranking or st.contest_global_ranking,
            delta_total=0,
            delta_easy=0,
            delta_medium=0,
            delta_hard=0,
            delta_rating=0.0,
            captured_at=now,
            sync_run_id="SYNC-ON-DEMAND",
            source="leetcode_public_profile"
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)
        snapshots = [snap]

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
        "snapshots": [StudentStatSnapshotOut.model_validate(s) for s in snapshots]
    }


@router.get("/growth/improvers", response_model=List[ImproverOut])
def get_top_improvers(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns top problem solving improvers (biggest delta) over specified period.
    Supports filtering by department code/id and academic year.
    """
    cutoff = _growth_cutoff(period)
    students = _filtered_growth_students(db, dept, dept_id, year, year_level)
    growth = _derived_growth(db, students, cutoff, period=period)
    
    results = []
    for student in students:
        current = student.stats
        cur_solved = (current.total_solved or 0) if current else 0
        values = growth.get(student.id, {"total": 0, "easy": 0, "medium": 0, "hard": 0, "rating": 0.0})
        
        if period != "all" and values["total"] <= 0:
            continue
        if period == "all":
            values = {
                "total": cur_solved, 
                "easy": current.easy_solved or 0 if current else 0, 
                "medium": current.medium_solved or 0 if current else 0, 
                "hard": current.hard_solved or 0 if current else 0, 
                "rating": current.contest_rating or 0.0 if current else 0.0
            }
        results.append((student, values))

    # Sort descending by delta_solved, delta_hard, delta_medium, delta_easy, delta_rating
    results.sort(key=lambda item: (
        -item[1]["total"],
        -item[1]["hard"],
        -item[1]["medium"],
        -item[1]["easy"],
        -item[1]["rating"],
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
            delta_solved=int(values["total"]),
            delta_easy=int(values["easy"]),
            delta_medium=int(values["medium"]),
            delta_hard=int(values["hard"]),
            delta_rating=round(float(values["rating"]), 1),
            current_contest_rating=cur_rating
        ))

    return improvers


@router.get("/growth/options")
def get_growth_options(db: Session = Depends(get_db)):
    """Return filter values from the active student records."""
    departments = db.query(Department.id, Department.code, Department.name).join(
        Student, Student.department_id == Department.id
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).distinct().order_by(Department.name.asc()).all()
    
    years = db.query(Student.year_level).filter(
        ((Student.is_active == True) | (Student.is_active.is_(None))) &
        Student.year_level.isnot(None)
    ).distinct().order_by(Student.year_level.asc()).all()
    
    return {
        "departments": [
            {"id": department_id, "code": code, "name": name}
            for department_id, code, name in departments
        ],
        "years": [year for (year,) in years if year]
    }


@router.get("/growth/college-delta")
def get_college_delta(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns aggregate college problem solved growth and difficulty breakdown over period,
    with support for department and academic year filters.
    """
    cutoff = _growth_cutoff(period)
    student_rows = _filtered_growth_students(db, dept, dept_id, year, year_level)
    growth = _derived_growth(db, student_rows, cutoff, period=period)
    
    period_totals = {
        key: sum(values[key] for values in growth.values())
        for key in ("total", "easy", "medium", "hard")
    }
    
    current_total = sum(
        ((student.stats.easy_solved or 0) + (student.stats.medium_solved or 0) + (student.stats.hard_solved or 0))
        if student.stats else 0
        for student in student_rows
    )
    current_easy = sum((student.stats.easy_solved or 0) for student in student_rows if student.stats)
    current_medium = sum((student.stats.medium_solved or 0) for student in student_rows if student.stats)
    current_hard = sum((student.stats.hard_solved or 0) for student in student_rows if student.stats)
    
    active_students = sum(1 for student in student_rows if (
        period == "all" and ((student.stats.total_solved or 0) > 0 if student.stats else False)
    ) or (
        period != "all" and growth.get(student.id, {}).get("total", 0) > 0
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
        "delta_total": int(period_totals["total"]),
        "delta_easy": int(period_totals["easy"]),
        "delta_medium": int(period_totals["medium"]),
        "delta_hard": int(period_totals["hard"]),
        "total_students": len(student_rows),
        "active_students": active_students,
        "active_solvers": active_students,
        "total_solved": selected_total,
        "easy_solved": selected_easy,
        "medium_solved": selected_medium,
        "hard_solved": selected_hard,
        "growth": int(period_totals["total"])
    }
