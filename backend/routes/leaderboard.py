from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import Student, WeeklyStudentProgress, Department, Section
from backend.schemas import StudentOut

router = APIRouter(prefix="/api/leaderboard", tags=["Leaderboard"])

from sqlalchemy.orm import joinedload

@router.get("", response_model=List[StudentOut])
def get_leaderboard(
    dept_id: Optional[int] = Query(None),
    year_level: Optional[str] = Query(None),
    section_id: Optional[int] = Query(None),
    sort_by: str = Query("solved", enum=["solved", "progress", "rating", "streak"]),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Student).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(Student.is_active == True)

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level:
        query = query.filter(Student.year_level == year_level)
    if section_id:
        query = query.filter(Student.section_id == section_id)

    students = query.all()
    if not students:
        return []

    # Batch fetch all student progress in 1 single query
    student_ids = [st.id for st in students]
    progs = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id.in_(student_ids)
    ).all()

    prog_map = {}
    for p in progs:
        if p.student_id not in prog_map or p.id > prog_map[p.student_id].id:
            prog_map[p.student_id] = p

    results = []
    for st in students:
        st_out = StudentOut.from_orm(st)
        latest_prog = prog_map.get(st.id)
        if latest_prog:
            st_out.college_rank = latest_prog.college_rank
            st_out.dept_rank = latest_prog.dept_rank
            st_out.year_rank = latest_prog.year_rank
            st_out.section_rank = latest_prog.section_rank
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.streak_count = latest_prog.streak_count
            st_out.consistency_score = latest_prog.consistency_score
            st_out.badge_list = latest_prog.badge_list or []
        results.append(st_out)

    # Sort based on criteria
    if sort_by == "solved":
        results.sort(key=lambda x: (x.stats.total_solved if x.stats else 0), reverse=True)
    elif sort_by == "progress":
        results.sort(key=lambda x: (x.weekly_progress or 0), reverse=True)
    elif sort_by == "rating":
        results.sort(key=lambda x: (x.stats.contest_rating if (x.stats and x.stats.contest_rating) else -1), reverse=True)
    elif sort_by == "streak":
        results.sort(key=lambda x: (x.streak_count or 0), reverse=True)

    return results[:limit]

@router.get("/top-performers")
def get_top_performers(db: Session = Depends(get_db)):
    students = db.query(Student).filter(Student.is_active == True).all()
    if not students:
        return {
            "highest_solved": None,
            "highest_progress": None,
            "highest_rating": None,
            "longest_streak": None
        }

    st_outs = []
    for st in students:
        st_out = StudentOut.from_orm(st)
        latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == st.id).order_by(WeeklyStudentProgress.id.desc()).first()
        if latest_prog:
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.streak_count = latest_prog.streak_count
            st_out.badge_list = latest_prog.badge_list or []
        st_outs.append(st_out)

    highest_solved = max(st_outs, key=lambda x: (x.stats.total_solved if x.stats else 0), default=None)
    highest_progress = max(st_outs, key=lambda x: (x.weekly_progress or 0), default=None)
    highest_rating = max(st_outs, key=lambda x: (x.stats.contest_rating if (x.stats and x.stats.contest_rating) else -1), default=None)
    longest_streak = max(st_outs, key=lambda x: (x.streak_count or 0), default=None)

    return {
        "highest_solved": highest_solved,
        "highest_progress": highest_progress,
        "highest_rating": highest_rating if (highest_rating and highest_rating.stats and highest_rating.stats.contest_rating) else None,
        "longest_streak": longest_streak
    }
