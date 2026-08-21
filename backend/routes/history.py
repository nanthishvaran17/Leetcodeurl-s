from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import datetime

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, Section, LeetCodeProfileStats
from backend.schemas import StudentStatSnapshotOut, ImproverOut

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

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
    now = datetime.datetime.now(datetime.timezone.utc)
    if period == "today":
        cutoff = now - datetime.timedelta(days=1)
    elif period == "7d":
        cutoff = now - datetime.timedelta(days=7)
    elif period == "30d":
        cutoff = now - datetime.timedelta(days=30)
    else:
        cutoff = datetime.datetime(2020, 1, 1)

    # Subquery for sum of deltas per student since cutoff
    subq = db.query(
        StudentStatSnapshot.student_id.label("sid"),
        func.sum(StudentStatSnapshot.delta_total).label("sum_delta_total"),
        func.sum(StudentStatSnapshot.delta_easy).label("sum_delta_easy"),
        func.sum(StudentStatSnapshot.delta_medium).label("sum_delta_medium"),
        func.sum(StudentStatSnapshot.delta_hard).label("sum_delta_hard"),
        func.sum(StudentStatSnapshot.delta_rating).label("sum_delta_rating")
    ).filter(
        StudentStatSnapshot.captured_at >= cutoff
    ).group_by(StudentStatSnapshot.student_id).subquery()

    query = db.query(
        Student, subq.c.sum_delta_total, subq.c.sum_delta_easy,
        subq.c.sum_delta_medium, subq.c.sum_delta_hard, subq.c.sum_delta_rating
    ).join(subq, Student.id == subq.c.sid).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )

    # Apply Department Filter
    effective_dept = dept or ""
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    elif effective_dept and effective_dept.upper() not in ['ALL', 'ALL DEPARTMENTS', '']:
        query = query.join(Student.department).filter(
            (Department.code.ilike(f"%{effective_dept.strip()}%")) |
            (Department.name.ilike(f"%{effective_dept.strip()}%"))
        )

    # Apply Year Filter
    effective_year = year or year_level or ""
    if effective_year and effective_year.strip().upper() not in ['ALL', 'ALL YEARS', 'ALL ACADEMIC YEARS', '']:
        query = query.filter(func.upper(Student.year_level) == effective_year.strip().upper())

    results = query.order_by(subq.c.sum_delta_total.desc()).limit(limit).all()

    improvers = []
    for st, d_tot, d_ez, d_med, d_hd, d_rat in results:
        dept_code = st.department.code if st.department else "CSE"
        sec_name = st.section.name if st.section else "A"
        cur_solved = st.stats.total_solved if st.stats else 0
        cur_rating = st.stats.contest_rating if st.stats else None

        # Sanitize rating delta (ignore baseline uninitialized artifacts)
        clean_d_rat = float(d_rat or 0.0)
        if clean_d_rat < -400 or clean_d_rat > 400:
            clean_d_rat = 0.0

        improvers.append(ImproverOut(
            student_id=st.id,
            reg_no=st.reg_no,
            name=st.name,
            department_code=dept_code,
            year_level=st.year_level,
            section_name=sec_name,
            total_solved=cur_solved,
            delta_solved=int(d_tot or 0),
            delta_easy=int(d_ez or 0),
            delta_medium=int(d_med or 0),
            delta_hard=int(d_hd or 0),
            delta_rating=round(clean_d_rat, 1),
            current_contest_rating=cur_rating
        ))

    return improvers

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
    now = datetime.datetime.now(datetime.timezone.utc)
    if period == "today":
        cutoff = now - datetime.timedelta(days=1)
    elif period == "7d":
        cutoff = now - datetime.timedelta(days=7)
    elif period == "30d":
        cutoff = now - datetime.timedelta(days=30)
    else:
        cutoff = datetime.datetime(2020, 1, 1)

    query = db.query(
        func.coalesce(func.sum(StudentStatSnapshot.delta_total), 0).label("tot"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_easy), 0).label("ez"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_medium), 0).label("med"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_hard), 0).label("hd")
    ).filter(StudentStatSnapshot.captured_at >= cutoff)

    # Department & Year filtering
    effective_dept = dept or ""
    effective_year = year or year_level or ""

    if dept_id or (effective_dept and effective_dept.upper() not in ['ALL', 'ALL DEPARTMENTS', '']) or (effective_year and effective_year.strip().upper() not in ['ALL', 'ALL YEARS', 'ALL ACADEMIC YEARS', '']):
        query = query.join(Student, StudentStatSnapshot.student_id == Student.id)
        if dept_id:
            query = query.filter(Student.department_id == dept_id)
        elif effective_dept and effective_dept.upper() not in ['ALL', 'ALL DEPARTMENTS', '']:
            query = query.join(Department, Student.department_id == Department.id).filter(
                (Department.code.ilike(f"%{effective_dept.strip()}%")) |
                (Department.name.ilike(f"%{effective_dept.strip()}%"))
            )
        if effective_year and effective_year.strip().upper() not in ['ALL', 'ALL YEARS', 'ALL ACADEMIC YEARS', '']:
            query = query.filter(func.upper(Student.year_level) == effective_year.strip().upper())

    result = query.first()

    return {
        "period": period,
        "delta_total": int(result.tot) if result else 0,
        "delta_easy": int(result.ez) if result else 0,
        "delta_medium": int(result.med) if result else 0,
        "delta_hard": int(result.hd) if result else 0
    }
