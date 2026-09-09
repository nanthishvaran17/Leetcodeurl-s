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
    
    # 1. Base query for authorized students
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if dept_id:
        base_student_query = base_student_query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(func.upper(Student.year_level) == year_level.upper().replace(" YEAR", ""))
    if batch and batch.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(Student.batch == batch)
        
    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)
        
    student_subquery = base_student_query.subquery()
    
    # Check if there are any students to avoid expensive subqueries if empty
    student_count = db.query(func.count(student_subquery.c.id)).scalar()
    if not student_count or student_count == 0:
        return {"error": "No students found in scope", "data": None}
    
    # 2. Daily Trend Aggregation using PostgreSQL GROUP BY
    date_col = func.date(StudentStatSnapshot.captured_at).label("date")
    trend_aggregates = db.query(
        date_col,
        func.avg(StudentStatSnapshot.contest_rating).label("avg_rating"),
        func.avg(StudentStatSnapshot.total_solved).label("avg_solved")
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).group_by(date_col).order_by(date_col.asc()).all()

    trend_data = []
    for row in trend_aggregates:
        trend_data.append({
            "date": str(row.date),
            "avg_rating": round(row.avg_rating, 1) if row.avg_rating is not None else None,
            "avg_solved": round(row.avg_solved, 1) if row.avg_solved is not None else None
        })

    # 3. Overall Difficulty & Submission Stats Aggregation
    stats_aggregate = db.query(
        func.sum(LeetCodeProfileStats.easy_solved).label("easy"),
        func.sum(LeetCodeProfileStats.medium_solved).label("medium"),
        func.sum(LeetCodeProfileStats.hard_solved).label("hard")
    ).join(
        student_subquery, LeetCodeProfileStats.student_id == student_subquery.c.id
    ).first()

    current_easy = int(stats_aggregate.easy or 0) if stats_aggregate else 0
    current_medium = int(stats_aggregate.medium or 0) if stats_aggregate else 0
    current_hard = int(stats_aggregate.hard or 0) if stats_aggregate else 0
    total_submissions = 0 # Not supported by LeetCodeProfileStats schema
    
    difficulty_distribution = [
        {"name": "Easy", "value": current_easy},
        {"name": "Medium", "value": current_medium},
        {"name": "Hard", "value": current_hard}
    ]
    
    total_solved = current_easy + current_medium + current_hard
    acceptance_rate = round((total_solved / total_submissions) * 100, 2) if total_submissions > 0 else 0

    return {
        "trend_data": trend_data,
        "difficulty_distribution": difficulty_distribution,
        "acceptance_rate": acceptance_rate,
        "total_submissions": total_submissions,
        "total_solved": total_solved
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

    # 1. Base query for authorized students
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if dept_id:
        base_student_query = base_student_query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(func.upper(Student.year_level) == year_level.upper().replace(" YEAR", ""))
    if batch and batch.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(Student.batch == batch)

    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)

    student_subquery = base_student_query.subquery()

    # Aggregate for current period
    current_agg = db.query(
        func.avg(StudentStatSnapshot.contest_rating).label("avg_rating"),
        func.sum(StudentStatSnapshot.delta_total).label("solved_delta")
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= current_start,
        StudentStatSnapshot.captured_at <= current_end
    ).first()

    # Aggregate for previous period
    prev_agg = db.query(
        func.avg(StudentStatSnapshot.contest_rating).label("avg_rating"),
        func.sum(StudentStatSnapshot.delta_total).label("solved_delta")
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= prev_start,
        StudentStatSnapshot.captured_at <= prev_end
    ).first()

    return {
        "current_period": {
            "start": current_start,
            "end": current_end,
            "avg_rating": round(current_agg.avg_rating, 1) if current_agg and current_agg.avg_rating else 0,
            "solved_growth": int(current_agg.solved_delta) if current_agg and current_agg.solved_delta else 0
        },
        "previous_period": {
            "start": prev_start,
            "end": prev_end,
            "avg_rating": round(prev_agg.avg_rating, 1) if prev_agg and prev_agg.avg_rating else 0,
            "solved_growth": int(prev_agg.solved_delta) if prev_agg and prev_agg.solved_delta else 0
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

@router.get("/department-comparison")
def get_department_comparison(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    departments = db.query(Department).filter(
        ~Department.code.ilike('%test%'),
        ~Department.name.ilike('%test%')
    ).all()
    res = []
    for dept in departments:
        # Base query for students in this department
        query = db.query(Student).filter(Student.department_id == dept.id, Student.is_active == True)
        
        # Apply RBAC (HOD scoped)
        if current_user:
            query = apply_role_based_student_filter(query, current_user, db)
            
        students = query.all()
        student_ids = [s.id for s in students]
        total_students = len(student_ids)
        
        if total_students == 0:
            res.append({
                "department_id": dept.id,
                "department_name": dept.name,
                "department_code": dept.code,
                "total_students": 0,
                "active_students": 0,
                "active_count": 0,
                "participation_rate": 0,
                "avg_solved": 0,
                "avg_rating": 0,
                "top_performer": None
            })
            continue
            
        stats = db.query(
            func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.total_solved > 0).label("active_count"),
            func.avg(LeetCodeProfileStats.total_solved).label("avg_solved"),
            func.avg(LeetCodeProfileStats.contest_rating).label("avg_rating")
        ).filter(LeetCodeProfileStats.student_id.in_(student_ids)).first()
        
        active_count = stats.active_count or 0
        participation_rate = round((active_count / total_students) * 100, 2) if total_students > 0 else 0
        
        # Find top performer
        top_student_stat = db.query(LeetCodeProfileStats).filter(
            LeetCodeProfileStats.student_id.in_(student_ids)
        ).order_by(LeetCodeProfileStats.total_solved.desc()).first()
        
        top_performer = None
        if top_student_stat and top_student_stat.student:
            top_performer = {
                "name": top_student_stat.student.name or top_student_stat.student.username,
                "reg_no": top_student_stat.student.reg_no,
                "solved": top_student_stat.total_solved or 0
            }
        
        res.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "department_code": dept.code,
            "total_students": total_students,
            "active_students": active_count,
            "active_count": active_count,
            "participation_rate": participation_rate,
            "avg_solved": round(stats.avg_solved or 0, 1),
            "avg_rating": round(stats.avg_rating or 0, 1),
            "top_performer": top_performer
        })
    return res

@router.get("/data-quality")
def get_data_quality(force_refresh: bool = False, db: Session = Depends(get_db)):
    students = db.query(Student).filter(Student.is_active == True).all()
    total = len(students)
    if total == 0:
        return {"health_score_percentage": 100, "valid_profiles": 0, "issues_count": 0, "issues_list": []}
        
    issues = []
    valid = 0
    for s in students:
        s_issues = []
        if not s.leetcode_url:
            s_issues.append(f"{s.reg_no or s.name}: Missing LeetCode URL")
        elif "/u/" not in s.leetcode_url and "leetcode.com" in s.leetcode_url:
            s_issues.append(f"{s.reg_no or s.name}: Invalid URL format")
            
        if not s.reg_no:
            s_issues.append(f"Missing Reg No for student ID {s.id}")
            
        if s_issues:
            issues.extend(s_issues)
        else:
            valid += 1
            
    score = int((valid / total) * 100) if total > 0 else 100
    
    return {
        "health_score_percentage": score,
        "valid_profiles": valid,
        "issues_count": len(issues),
        "issues_list": issues[:50]
    }

@router.get("/performance-chart")
def get_performance_chart(timeframe: str = Query("monthly"), db: Session = Depends(get_db)):
    start_dt, end_dt = resolve_date_range(timeframe)
    
    date_col = func.date(StudentStatSnapshot.captured_at).label("date")
    trend_aggregates = db.query(
        date_col,
        func.sum(StudentStatSnapshot.total_solved).label("problemsSolved"),
        func.count(func.distinct(StudentStatSnapshot.student_id)).label("activeStudents")
    ).filter(
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).group_by(date_col).order_by(date_col.asc()).all()
    
    data = []
    for row in trend_aggregates:
        data.append({
            "label": str(row.date),
            "problemsSolved": int(row.problemsSolved or 0),
            "activeStudents": int(row.activeStudents or 0)
        })
        
    if not data:
        data = [
            {"label": "No Data", "problemsSolved": 0, "activeStudents": 0}
        ]
        
    return {"data": data}


@router.get("/contest/aggregate")
def get_contest_aggregate(
    period: str = Query("30d"),
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    batch: Optional[str] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    start_dt, end_dt = resolve_date_range(period, custom_start, custom_end)
    
    # Base query for authorized students
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if student_id:
        base_student_query = base_student_query.filter(Student.id == student_id)
    if dept_id:
        base_student_query = base_student_query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(func.upper(Student.year_level) == year_level.upper().replace(" YEAR", ""))
    if batch and batch.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(Student.batch == batch)
        
    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)
        
    student_subquery = base_student_query.subquery()
    student_count = db.query(func.count(student_subquery.c.id)).scalar()
    
    if not student_count or student_count == 0:
        return {"error": "No students found in scope", "data": None}

    # Aggregate stats
    contests_query = db.query(StudentContestSnapshot).filter(
        StudentContestSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentContestSnapshot.captured_at >= start_dt,
        StudentContestSnapshot.captured_at <= end_dt
    )

    agg = db.query(
        func.count(func.distinct(StudentContestSnapshot.contest_name)).label("total_contests"),
        func.count(StudentContestSnapshot.id).label("total_participations"),
        func.min(StudentContestSnapshot.contest_rank).label("best_rank"),
        func.avg(StudentContestSnapshot.contest_rank).label("avg_rank"),
        func.sum(StudentContestSnapshot.questions_solved).label("problems_solved"),
        func.avg(StudentContestSnapshot.questions_solved).label("avg_solved"),
    ).filter(
        StudentContestSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentContestSnapshot.captured_at >= start_dt,
        StudentContestSnapshot.captured_at <= end_dt
    ).first()

    # Trend data
    date_col = func.date(StudentContestSnapshot.captured_at).label("date")
    trend = db.query(
        date_col,
        func.avg(StudentContestSnapshot.contest_rating).label("avg_rating"),
        func.avg(StudentContestSnapshot.contest_rank).label("avg_rank")
    ).filter(
        StudentContestSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentContestSnapshot.captured_at >= start_dt,
        StudentContestSnapshot.captured_at <= end_dt
    ).group_by(date_col).order_by(date_col.asc()).all()

    # Top performers
    top_performers = db.query(
        StudentContestSnapshot.student_id,
        func.max(Student.name).label("name"),
        func.max(Student.reg_no).label("reg_no"),
        func.max(StudentContestSnapshot.contest_rating).label("rating"),
        func.min(StudentContestSnapshot.contest_rank).label("best_rank"),
        func.sum(StudentContestSnapshot.questions_solved).label("solved")
    ).join(
        Student, Student.id == StudentContestSnapshot.student_id
    ).filter(
        StudentContestSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentContestSnapshot.captured_at >= start_dt,
        StudentContestSnapshot.captured_at <= end_dt
    ).group_by(StudentContestSnapshot.student_id).order_by(desc("rating")).limit(10).all()

    return {
        "summary": {
            "total_contests": agg.total_contests or 0,
            "participations": agg.total_participations or 0,
            "participation_rate": round((agg.total_participations / (agg.total_contests * student_count)) * 100, 1) if agg.total_contests and student_count else 0,
            "best_rank": agg.best_rank,
            "avg_rank": round(agg.avg_rank, 1) if agg.avg_rank else None,
            "problems_solved": agg.problems_solved or 0,
            "avg_solved": round(agg.avg_solved, 1) if agg.avg_solved else 0,
        },
        "trend": [
            {"date": str(t.date), "avg_rating": round(t.avg_rating, 1) if t.avg_rating else None, "avg_rank": round(t.avg_rank, 1) if t.avg_rank else None}
            for t in trend
        ],
        "top_performers": [
            {"student_id": p.student_id, "name": p.name, "reg_no": p.reg_no, "rating": p.rating, "best_rank": p.best_rank, "solved": p.solved}
            for p in top_performers
        ]
    }


@router.get("/activity/aggregate")
def get_activity_aggregate(
    period: str = Query("30d"),
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    batch: Optional[str] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    start_dt, end_dt = resolve_date_range(period, custom_start, custom_end)
    
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if student_id:
        base_student_query = base_student_query.filter(Student.id == student_id)
    if dept_id:
        base_student_query = base_student_query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(func.upper(Student.year_level) == year_level.upper().replace(" YEAR", ""))
    if batch and batch.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(Student.batch == batch)
        
    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)
        
    student_subquery = base_student_query.subquery()
    student_count = db.query(func.count(student_subquery.c.id)).scalar()
    
    if not student_count or student_count == 0:
        return {"error": "No students found in scope", "data": None}

    # Aggregate stats
    agg = db.query(
        func.sum(StudentStatSnapshot.delta_total).label("total_submissions"), # total_submissions approximated by delta_total if we don't have submissions
        func.count(func.distinct(StudentStatSnapshot.student_id)).label("active_students"),
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).first()

    # Daily trend
    date_col = func.date(StudentStatSnapshot.captured_at).label("date")
    trend = db.query(
        date_col,
        func.sum(StudentStatSnapshot.delta_total).label("daily_submissions"),
        func.count(func.distinct(StudentStatSnapshot.student_id)).label("active_students")
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).group_by(date_col).order_by(date_col.asc()).all()
    
    # Most active
    most_active = db.query(
        StudentStatSnapshot.student_id,
        func.max(Student.name).label("name"),
        func.max(Student.reg_no).label("reg_no"),
        func.sum(StudentStatSnapshot.delta_total).label("total_solved")
    ).join(
        Student, Student.id == StudentStatSnapshot.student_id
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).group_by(StudentStatSnapshot.student_id).order_by(desc("total_solved")).limit(10).all()

    return {
        "summary": {
            "total_submissions": agg.total_submissions or 0,
            "active_students": agg.active_students or 0,
            "active_rate": round((agg.active_students / student_count) * 100, 1) if student_count else 0,
        },
        "trend": [
            {"date": str(t.date), "submissions": t.daily_submissions or 0, "active_students": t.active_students or 0}
            for t in trend
        ],
        "most_active": [
            {"student_id": m.student_id, "name": m.name, "reg_no": m.reg_no, "solved": m.total_solved}
            for m in most_active
        ]
    }
