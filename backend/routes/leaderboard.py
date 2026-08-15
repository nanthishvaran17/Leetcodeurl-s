from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from sqlalchemy import func, desc, nullslast

from backend.database import get_db
from backend.models import Student, WeeklyStudentProgress, Department, Section, LeetCodeProfileStats
from backend.schemas import StudentOut
from backend.cache import cache

router = APIRouter(prefix="/api/leaderboard", tags=["Leaderboard"])

@router.get("", response_model=List[StudentOut])
def get_leaderboard(
    dept_id: Optional[int] = Query(None),
    year_level: Optional[str] = Query(None),
    section_id: Optional[int] = Query(None),
    sort_by: str = Query("solved", enum=["solved", "progress", "rating", "streak"]),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    cache_key = f"leaderboard:{dept_id}:{year_level}:{section_id}:{sort_by}:{limit}"
    cached_res = cache.get(cache_key)
    if cached_res is not None:
        return cached_res

    query = db.query(Student).join(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None)),
        LeetCodeProfileStats.sync_status.in_(["success", "OK", "verified"]),
        LeetCodeProfileStats.total_solved.isnot(None)
    )

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ['ALL', 'ALL YEARS', '']:
        clean_yr = year_level.strip().upper().replace('YEAR', '').strip()
        query = query.filter(func.upper(Student.year_level) == clean_yr)
    if section_id:
        query = query.filter(Student.section_id == section_id)

    # Database-level sorting for solved and rating
    if sort_by == "solved":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.total_solved)), Student.name.asc())
    elif sort_by == "rating":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.contest_rating)), Student.name.asc())
    elif sort_by == "streak":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.max_streak)), Student.name.asc())

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

    # In-memory secondary sort only if sorting by progress (which lives on progress records)
    if sort_by == "progress":
        results.sort(key=lambda x: (x.weekly_progress or 0), reverse=True)

    final_results = results[:limit]
    cache.set(cache_key, final_results, ttl_seconds=30, tags=["leaderboard"])
    return final_results

@router.get("/top-performers")
def get_top_performers(db: Session = Depends(get_db)):
    cache_key = "top_performers_summary"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # 1 query for active students with stats and joined loads
    students = db.query(Student).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).all()

    if not students:
        return {
            "highest_solved": None,
            "highest_progress": None,
            "highest_rating": None,
            "longest_streak": None
        }

    # 1 single batch query for progress records
    student_ids = [st.id for st in students]
    progs = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id.in_(student_ids)
    ).all()

    prog_map = {}
    for p in progs:
        if p.student_id not in prog_map or p.id > prog_map[p.student_id].id:
            prog_map[p.student_id] = p

    st_outs = []
    for st in students:
        st_out = StudentOut.from_orm(st)
        latest_prog = prog_map.get(st.id)
        if latest_prog:
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.streak_count = latest_prog.streak_count
            st_out.badge_list = latest_prog.badge_list or []
        st_outs.append(st_out)

    highest_solved = max(st_outs, key=lambda x: (x.stats.total_solved or 0) if x.stats else 0, default=None)
    highest_progress = max(st_outs, key=lambda x: (x.weekly_progress or 0), default=None)
    highest_rating = max(st_outs, key=lambda x: (x.stats.contest_rating or -1) if (x.stats and x.stats.contest_rating) else -1, default=None)
    longest_streak = max(st_outs, key=lambda x: (x.streak_count or 0), default=None)

    resp = {
        "highest_solved": highest_solved,
        "highest_progress": highest_progress,
        "highest_rating": highest_rating if (highest_rating and highest_rating.stats and highest_rating.stats.contest_rating) else None,
        "longest_streak": longest_streak
    }
    cache.set(cache_key, resp, ttl_seconds=30, tags=["leaderboard"])
    return resp
