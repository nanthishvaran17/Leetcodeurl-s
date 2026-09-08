from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc
from typing import List, Optional, Dict, Any, Tuple
import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict
import json

from backend.database import get_db
from backend.models import (
    Student, StudentStatSnapshot, StudentContestSnapshot, Department, User, LeetCodeProfileStats
)
from backend.security import get_current_user_optional
from backend.services.authorization_service import apply_role_based_student_filter

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Graphs"])

IST_TZ = ZoneInfo("Asia/Kolkata")
UTC_TZ = datetime.timezone.utc

def resolve_date_range(period: str, custom_start: Optional[str] = None, custom_end: Optional[str] = None) -> Tuple[datetime.datetime, datetime.datetime]:
    now_ist = datetime.datetime.now(IST_TZ)
    start_dt = None
    end_dt = now_ist
    
    if period == "today":
        start_dt = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "yesterday":
        start_dt = (now_ist - datetime.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + datetime.timedelta(days=1) - datetime.timedelta(microseconds=1)
    elif period == "this_week":
        start_dt = (now_ist - datetime.timedelta(days=now_ist.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_week":
        start_of_this_week = (now_ist - datetime.timedelta(days=now_ist.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        start_dt = start_of_this_week - datetime.timedelta(days=7)
        end_dt = start_of_this_week - datetime.timedelta(microseconds=1)
    elif period == "this_month":
        start_dt = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_month":
        first_day_this_month = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = first_day_this_month - datetime.timedelta(microseconds=1)
        start_dt = end_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "30d":
        start_dt = now_ist - datetime.timedelta(days=30)
    elif period == "90d":
        start_dt = now_ist - datetime.timedelta(days=90)
    elif period == "academic_year":
        start_year = now_ist.year if now_ist.month >= 6 else now_ist.year - 1
        start_dt = datetime.datetime(start_year, 6, 1, tzinfo=IST_TZ)
    elif period == "custom" and custom_start and custom_end:
        try:
            start_dt = datetime.datetime.fromisoformat(custom_start.replace('Z', '+00:00')).astimezone(IST_TZ)
            end_dt = datetime.datetime.fromisoformat(custom_end.replace('Z', '+00:00')).astimezone(IST_TZ)
        except:
            start_dt = now_ist - datetime.timedelta(days=30)
    else: 
        start_dt = now_ist - datetime.timedelta(days=30)
        
    return start_dt.astimezone(UTC_TZ), end_dt.astimezone(UTC_TZ)

def _filtered_students(
    db: Session, 
    dept_id: Optional[int], 
    year_level: Optional[str],
    batch: Optional[str] = None,
    current_user: Optional[User] = None
) -> List[Student]:
    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() not in ("", "ALL"):
        query = query.filter(func.upper(Student.year_level) == year_level.upper().replace(" YEAR", ""))
    if batch and batch.upper() not in ("", "ALL"):
        query = query.filter(Student.batch == batch)
        
    if current_user:
        query = apply_role_based_student_filter(query, current_user, db)
        
    return query.all()

@router.get("/dashboard")
def get_analytics_dashboard(
    period: str = Query("30d"),
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    batch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    start_dt, end_dt = resolve_date_range(period, custom_start, custom_end)
    students = _filtered_students(db, dept_id, year_level, batch, current_user)
    if not students:
        return {"error": "No students found in scope", "data": None}
        
    student_ids = [s.id for s in students]
    
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).order_by(StudentStatSnapshot.captured_at.asc()).all()
    
    trend_by_date = defaultdict(lambda: {"total_rating": 0, "rating_count": 0, "total_solved": 0, "solved_count": 0})
    for snap in snapshots:
        date_str = snap.captured_at.strftime("%Y-%m-%d")
        if snap.contest_rating:
            trend_by_date[date_str]["total_rating"] += snap.contest_rating
            trend_by_date[date_str]["rating_count"] += 1
        if snap.total_solved:
            trend_by_date[date_str]["total_solved"] += snap.total_solved
            trend_by_date[date_str]["solved_count"] += 1
            
    trend_data = []
    for date_str in sorted(trend_by_date.keys()):
        stats = trend_by_date[date_str]
        trend_data.append({
            "date": date_str,
            "avg_rating": round(stats["total_rating"] / stats["rating_count"], 1) if stats["rating_count"] > 0 else None,
            "avg_solved": round(stats["total_solved"] / stats["solved_count"], 1) if stats["solved_count"] > 0 else None
        })
        
    current_easy = sum((s.stats.easy_solved or 0) for s in students if s.stats)
    current_medium = sum((s.stats.medium_solved or 0) for s in students if s.stats)
    current_hard = sum((s.stats.hard_solved or 0) for s in students if s.stats)
    
    difficulty_distribution = [
        {"name": "Easy", "value": current_easy},
        {"name": "Medium", "value": current_medium},
        {"name": "Hard", "value": current_hard}
    ]
    
    total_submissions_current = 0
    total_solved_current = current_easy + current_medium + current_hard
    
    for s in students:
        if s.stats and s.stats.total_submission_count:
            total_submissions_current += s.stats.total_submission_count
            
    acceptance_rate = round((total_solved_current / total_submissions_current) * 100, 2) if total_submissions_current > 0 else 0

    return {
        "trend_data": trend_data,
        "difficulty_distribution": difficulty_distribution,
        "acceptance_rate": acceptance_rate,
        "total_submissions": total_submissions_current,
        "total_solved": total_solved_current
    }
@router.get("/compare-period")
def get_analytics_compare_period(
    period: str = Query("this_week"),
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    batch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    current_start, current_end = resolve_date_range(period, custom_start, custom_end)
    duration = current_end - current_start
    prev_start = current_start - duration
    prev_end = current_start - datetime.timedelta(microseconds=1)
    
    students = _filtered_students(db, dept_id, year_level, batch, current_user)
    if not students:
        return {"error": "No students found in scope", "data": None}
    student_ids = [s.id for s in students]
    
    current_snaps = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids),
        StudentStatSnapshot.captured_at >= current_start,
        StudentStatSnapshot.captured_at <= current_end
    ).all()
    
    prev_snaps = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids),
        StudentStatSnapshot.captured_at >= prev_start,
        StudentStatSnapshot.captured_at <= prev_end
    ).all()
    
    # Calculate simple sums for current vs prev
    current_total_rating = sum(s.contest_rating for s in current_snaps if s.contest_rating)
    current_count_rating = sum(1 for s in current_snaps if s.contest_rating)
    prev_total_rating = sum(s.contest_rating for s in prev_snaps if s.contest_rating)
    prev_count_rating = sum(1 for s in prev_snaps if s.contest_rating)
    
    current_solved_delta = sum(s.delta_total or 0 for s in current_snaps)
    prev_solved_delta = sum(s.delta_total or 0 for s in prev_snaps)
    
    return {
        "current_period": {
            "start": current_start,
            "end": current_end,
            "avg_rating": round(current_total_rating/current_count_rating, 1) if current_count_rating > 0 else 0,
            "solved_growth": current_solved_delta
        },
        "previous_period": {
            "start": prev_start,
            "end": prev_end,
            "avg_rating": round(prev_total_rating/prev_count_rating, 1) if prev_count_rating > 0 else 0,
            "solved_growth": prev_solved_delta
        }
    }

@router.get("/student/{student_id}")
def get_individual_analytics(
    student_id: int,
    period: str = Query("30d"),
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if current_user:
        try:
            # We enforce RBAC directly by calling _filtered_students and checking presence
            # But simpler to just use apply_role_based_student_filter on a direct query
            q = db.query(Student).filter(Student.id == student_id)
            q = apply_role_based_student_filter(q, current_user, db)
            if not q.first():
                raise HTTPException(status_code=403, detail="Not authorized to view this student")
        except Exception:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    start_dt, end_dt = resolve_date_range(period, custom_start, custom_end)
    
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id == student_id,
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).order_by(StudentStatSnapshot.captured_at.asc()).all()
    
    contests = db.query(StudentContestSnapshot).filter(
        StudentContestSnapshot.student_id == student_id,
        StudentContestSnapshot.captured_at >= start_dt,
        StudentContestSnapshot.captured_at <= end_dt
    ).order_by(StudentContestSnapshot.captured_at.asc()).all()
    
    trend_data = []
    for snap in snapshots:
        trend_data.append({
            "date": snap.captured_at.strftime("%Y-%m-%d"),
            "rating": snap.contest_rating,
            "total_solved": snap.total_solved,
            "easy": snap.easy_solved,
            "medium": snap.medium_solved,
            "hard": snap.hard_solved
        })
        
    contest_data = []
    for c in contests:
        contest_data.append({
            "date": c.contest_date or c.captured_at.strftime("%Y-%m-%d"),
            "name": c.contest_name,
            "rating": c.contest_rating,
            "rank": c.contest_rank,
            "solved": c.questions_solved
        })
        
    return {
        "trend_data": trend_data,
        "contest_data": contest_data,
        "current_stats": {
            "total_solved": student.stats.total_solved if student.stats else 0,
            "rating": student.stats.contest_rating if student.stats else 0
        }
    }
