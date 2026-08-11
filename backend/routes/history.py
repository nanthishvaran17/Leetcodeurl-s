from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import datetime

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, Section, LeetCodeProfileStats
from backend.schemas import StudentStatSnapshotOut, ImproverOut

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

@router.get("/history/{student_id}", response_model=List[StudentStatSnapshotOut])
def get_student_history(
    student_id: int,
    limit: int = Query(50, ge=1, le=500),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns time-series historical snapshots for a specific student (Time Machine feature).
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    query = db.query(StudentStatSnapshot).filter(StudentStatSnapshot.student_id == student_id)

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
    return snapshots

@router.get("/growth/improvers", response_model=List[ImproverOut])
def get_top_improvers(
    period: str = Query("7d", regex="^(today|7d|30d|all)$"),
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns top problem solving improvers (biggest delta) over specified period.
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
        Student.is_active == True
    )

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ['ALL', 'ALL YEARS', '']:
        query = query.filter(func.upper(Student.year_level) == year_level.strip().upper())

    results = query.order_by(subq.c.sum_delta_total.desc()).limit(limit).all()

    improvers = []
    for st, d_tot, d_ez, d_med, d_hd, d_rat in results:
        dept_code = st.department.code if st.department else "GEN"
        sec_name = st.section.name if st.section else "A"
        cur_solved = st.stats.total_solved if st.stats else 0
        cur_rating = st.stats.contest_rating if st.stats else None

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
            delta_rating=round(float(d_rat or 0.0), 1),
            current_contest_rating=cur_rating
        ))

    return improvers

@router.get("/growth/college-delta")
def get_college_delta(
    period: str = Query("7d", regex="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db)
):
    """
    Returns aggregate college problem solved growth and difficulty breakdown over period.
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

    result = db.query(
        func.coalesce(func.sum(StudentStatSnapshot.delta_total), 0).label("tot"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_easy), 0).label("ez"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_medium), 0).label("med"),
        func.coalesce(func.sum(StudentStatSnapshot.delta_hard), 0).label("hd")
    ).filter(StudentStatSnapshot.captured_at >= cutoff).first()

    return {
        "period": period,
        "delta_total": int(result.tot) if result else 0,
        "delta_easy": int(result.ez) if result else 0,
        "delta_medium": int(result.med) if result else 0,
        "delta_hard": int(result.hd) if result else 0
    }
