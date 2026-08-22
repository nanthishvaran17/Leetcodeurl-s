from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, Section, LeetCodeProfileStats
from backend.schemas import StudentStatSnapshotOut, ImproverOut

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

def _growth_cutoff(period: str) -> datetime.datetime:
    now = datetime.datetime.now(datetime.timezone.utc)
    if period == "today":
        local_today = now.astimezone(ZoneInfo("Asia/Kolkata")).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return local_today.astimezone(datetime.timezone.utc)
    if period == "7d":
        return now - datetime.timedelta(days=7)
    if period == "30d":
        return now - datetime.timedelta(days=30)
    return datetime.datetime(2020, 1, 1, tzinfo=datetime.timezone.utc)

def _filtered_growth_students(db: Session, dept: Optional[str], dept_id: Optional[int], year: Optional[str], year_level: Optional[str]):
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

def _derived_growth(db: Session, students: list[Student], cutoff: datetime.datetime):
    if not students:
        return {}
    student_ids = [student.id for student in students]
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids)
    ).order_by(StudentStatSnapshot.student_id.asc(), StudentStatSnapshot.captured_at.asc()).all()
    grouped = defaultdict(list)
    for snapshot in snapshots:
        grouped[snapshot.student_id].append(snapshot)

    growth = {}
    for student_id in student_ids:
        totals = {"total": 0, "easy": 0, "medium": 0, "hard": 0, "rating": 0.0}
        previous = None
        for snapshot in grouped[student_id]:
            current = {
                "total": snapshot.total_solved or 0,
                "easy": snapshot.easy_solved or 0,
                "medium": snapshot.medium_solved or 0,
                "hard": snapshot.hard_solved or 0,
                "rating": snapshot.contest_rating or 0.0,
            }
            captured_at = snapshot.captured_at
            if captured_at.tzinfo is None:
                captured_at = captured_at.replace(tzinfo=datetime.timezone.utc)
            if previous is not None and captured_at >= cutoff:
                totals["total"] += max(0, current["total"] - previous["total"])
                totals["easy"] += max(0, current["easy"] - previous["easy"])
                totals["medium"] += max(0, current["medium"] - previous["medium"])
                totals["hard"] += max(0, current["hard"] - previous["hard"])
                totals["rating"] += current["rating"] - previous["rating"]
            previous = current
        growth[student_id] = totals
    return growth

def _current_total(student: Student) -> int:
    stats = student.stats
    return ((stats.easy_solved or 0) + (stats.medium_solved or 0) + (stats.hard_solved or 0)) if stats else 0

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
    if student_identifier.isdigit():
        student = db.query(Student).filter(Student.id == int(student_identifier)).first()
    
    if not student:
        student = db.query(Student).filter(
            (Student.reg_no.ilike(student_identifier.strip())) |
            (Student.username.ilike(student_identifier.strip())) |
            (Student.name.ilike(f"%{student_identifier.strip()}%"))
        ).first()

    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_identifier}' not found.")

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
    
    # Return enriched response containing student info + snapshots
    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "reg_no": student.reg_no,
            "username": student.username,
            "department": student.department.code if student.department else "CSE",
            "year": student.year_level
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
    growth = _derived_growth(db, students, cutoff)
    results = []
    for student in students:
        current = student.stats
        current_total = _current_total(student)
        values = growth[student.id]
        if period != "all" and values["total"] <= 0:
            continue
        if period == "all":
            values = {"total": current_total, "easy": current.easy_solved or 0 if current else 0, "medium": current.medium_solved or 0 if current else 0, "hard": current.hard_solved or 0 if current else 0, "rating": current.contest_rating or 0.0 if current else 0.0}
        results.append((student, values))
    results.sort(key=lambda item: (
        -item[1]["total"], -item[1]["hard"], -item[1]["medium"],
        -item[1]["easy"], -item[1]["rating"],
        -((item[0].stats.total_solved or 0) if item[0].stats else 0),
        item[0].name.lower(), item[0].id
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
        "years": [year for (year,) in years]
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
    growth = _derived_growth(db, student_rows, cutoff)
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
        period == "all" and _current_total(student) > 0
    ) or (
        period != "all" and growth[student.id]["total"] > 0
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
