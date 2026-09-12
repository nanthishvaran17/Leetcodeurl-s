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
    
    p = (period or "30d").lower().strip()
    if p in ("today", "daily"):
        start_dt = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    elif p in ("yesterday",):
        start_dt = (now_ist - datetime.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + datetime.timedelta(days=1) - datetime.timedelta(microseconds=1)
    elif p in ("this_week", "weekly"):
        start_dt = (now_ist - datetime.timedelta(days=now_ist.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif p in ("last_week",):
        start_of_this_week = (now_ist - datetime.timedelta(days=now_ist.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        start_dt = start_of_this_week - datetime.timedelta(days=7)
        end_dt = start_of_this_week - datetime.timedelta(microseconds=1)
    elif p in ("this_month", "monthly"):
        start_dt = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif p in ("last_month",):
        first_day_this_month = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = first_day_this_month - datetime.timedelta(microseconds=1)
        start_dt = end_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif p in ("30d", "last_30_days", "30_days"):
        start_dt = now_ist - datetime.timedelta(days=30)
    elif p in ("90d", "last_90_days", "90_days"):
        start_dt = now_ist - datetime.timedelta(days=90)
    elif p in ("academic_year", "yearly", "year"):
        start_year = now_ist.year if now_ist.month >= 6 else now_ist.year - 1
        start_dt = datetime.datetime(start_year, 6, 1, tzinfo=IST_TZ)
    elif p == "custom" and custom_start and custom_end:
        try:
            start_dt = datetime.datetime.fromisoformat(custom_start.replace('Z', '+00:00')).astimezone(IST_TZ)
            end_dt = datetime.datetime.fromisoformat(custom_end.replace('Z', '+00:00')).astimezone(IST_TZ)
        except Exception:
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

    # Map database aggregated rows into a lookup dictionary
    db_map = {}
    for row in trend_aggregates:
        r_val = round(float(row.avg_rating), 1) if row.avg_rating is not None and float(row.avg_rating) > 0 else None
        s_val = round(float(row.avg_solved), 1) if row.avg_solved is not None and float(row.avg_solved) > 0 else None
        db_map[str(row.date)] = {"avg_rating": r_val, "avg_solved": s_val}

    # Fetch live roster averages as initial fallback
    current_roster_stats = db.query(
        func.avg(LeetCodeProfileStats.contest_rating).label("avg_rating"),
        func.avg(LeetCodeProfileStats.total_solved).label("avg_solved")
    ).join(
        student_subquery, LeetCodeProfileStats.student_id == student_subquery.c.id
    ).first()

    fallback_rating = round(float(current_roster_stats.avg_rating or 1500.0), 1) if current_roster_stats and current_roster_stats.avg_rating else 1500.0
    fallback_solved = round(float(current_roster_stats.avg_solved or 150.0), 1) if current_roster_stats and current_roster_stats.avg_solved else 150.0

    # Generate continuous date list from start_dt to end_dt
    start_date = start_dt.date()
    end_date = end_dt.date()
    total_days = max(1, (end_date - start_date).days + 1)
    daily_dates = [start_date + datetime.timedelta(days=i) for i in range(total_days)]

    raw_trend = []
    last_rating = None
    last_solved = None

    # First pass: forward fill
    for d in daily_dates:
        d_str = d.strftime("%Y-%m-%d")
        item = db_map.get(d_str)

        r_val = item["avg_rating"] if item and item["avg_rating"] is not None else None
        s_val = item["avg_solved"] if item and item["avg_solved"] is not None else None

        if r_val is not None:
            last_rating = r_val
        else:
            r_val = last_rating

        if s_val is not None:
            last_solved = s_val
        else:
            s_val = last_solved

        raw_trend.append({
            "date": d_str,
            "avg_rating": r_val,
            "avg_solved": s_val
        })

    # Second pass: back fill for any initial missing dates
    first_valid_rating = next((t["avg_rating"] for t in raw_trend if t["avg_rating"] is not None), fallback_rating)
    first_valid_solved = next((t["avg_solved"] for t in raw_trend if t["avg_solved"] is not None), fallback_solved)

    trend_data = []
    for t in raw_trend:
        trend_data.append({
            "date": t["date"],
            "avg_rating": t["avg_rating"] if t["avg_rating"] is not None else first_valid_rating,
            "avg_solved": t["avg_solved"] if t["avg_solved"] is not None else first_valid_solved
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
    
    profile_stats = student.stats
    current_solved = profile_stats.total_solved if profile_stats else 0
    current_easy = profile_stats.easy_solved if profile_stats else 0
    current_medium = profile_stats.medium_solved if profile_stats else 0
    current_hard = profile_stats.hard_solved if profile_stats else 0
    current_rating = profile_stats.contest_rating if profile_stats else 1500.0

    trend_data = []
    for snap in snapshots:
        trend_data.append({
            "date": snap.captured_at.strftime("%Y-%m-%d"),
            "rating": snap.contest_rating or current_rating,
            "total_solved": min(snap.total_solved or 0, current_solved) if current_solved > 0 else (snap.total_solved or 0),
            "easy": snap.easy_solved or 0,
            "medium": snap.medium_solved or 0,
            "hard": snap.hard_solved or 0
        })

    # If no snapshots or single snapshot, populate baseline timeline from live profile_stats
    if not trend_data and profile_stats:
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        start_str = start_dt.strftime("%Y-%m-%d")
        trend_data = [
            {
                "date": start_str,
                "rating": current_rating,
                "total_solved": current_solved,
                "easy": current_easy,
                "medium": current_medium,
                "hard": current_hard
            },
            {
                "date": today_str,
                "rating": current_rating,
                "total_solved": current_solved,
                "easy": current_easy,
                "medium": current_medium,
                "hard": current_hard
            }
        ]
    elif len(trend_data) == 1 and profile_stats:
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        if trend_data[0]["date"] != today_str:
            trend_data.append({
                "date": today_str,
                "rating": current_rating,
                "total_solved": current_solved,
                "easy": current_easy,
                "medium": current_medium,
                "hard": current_hard
            })

    # Ensure final point aligns with current stats
    if trend_data and profile_stats:
        last_pt = trend_data[-1]
        if last_pt["total_solved"] < current_solved:
            last_pt["total_solved"] = current_solved
            last_pt["easy"] = current_easy
            last_pt["medium"] = current_medium
            last_pt["hard"] = current_hard
        
    contest_data = []
    for c in contests:
        contest_data.append({
            "date": c.contest_date or c.captured_at.strftime("%Y-%m-%d"),
            "name": c.contest_name,
            "rating": c.contest_rating,
            "rank": c.contest_rank,
            "solved": c.questions_solved
        })

    total_submissions = getattr(profile_stats, "total_submissions", 0) if profile_stats else 0
    acceptance_rate = round((current_solved / total_submissions) * 100, 1) if total_submissions > 0 else 0
        
    return {
        "trend_data": trend_data,
        "contest_data": contest_data,
        "current_stats": {
            "total_solved": current_solved,
            "easy": current_easy,
            "medium": current_medium,
            "hard": current_hard,
            "rating": current_rating,
            "total_submissions": total_submissions,
            "acceptance_rate": acceptance_rate
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
from sqlalchemy.orm import Session, joinedload

@router.get("/data-quality")
def get_data_quality(
    dept: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    attendance: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if not isinstance(dept, str):
        dept = "ALL"
    if not isinstance(year, str):
        year = "ALL"
    if not isinstance(attendance, str):
        attendance = "ALL"
    if not isinstance(search, str):
        search = None
    if not hasattr(current_user, "id"):
        current_user = None

    query = (
        db.query(Student)
        .options(joinedload(Student.department), joinedload(Student.stats))
        .filter((Student.is_active == True) | (Student.is_active.is_(None)))
    )

    if current_user:
        from backend.services.authorization_service import apply_role_based_student_filter
        query = apply_role_based_student_filter(query, current_user, db)

    students = query.order_by(Student.name.asc()).all()

    # Filter students in memory by dept, year, search
    if dept and dept != "ALL":
        d_upper = dept.upper()
        if d_upper in ("CSE(CS)", "CS", "CYBER"):
            students = [s for s in students if (s.department and ("CS" in s.department.code.upper() or "CYBER" in s.department.code.upper())) or ("CC" in (s.reg_no or "").upper())]
        elif d_upper in ("CSE(IOT)", "IOT"):
            students = [s for s in students if (s.department and "IOT" in s.department.code.upper()) or ("CI" in (s.reg_no or "").upper())]
        else:
            students = [s for s in students if s.department and s.department.code.upper() == d_upper]

    if year and year != "ALL":
        y_upper = year.upper()
        students = [s for s in students if str(s.year_level or "").upper() == y_upper or y_upper in str(s.year_level or "").upper()]

    if search:
        s_lower = search.strip().lower()
        students = [s for s in students if s_lower in (s.name or "").lower() or s_lower in (s.reg_no or "").lower() or s_lower in (s.username or "").lower()]

    total = len(students)
    if total == 0:
        return {
            "health_score_percentage": 100,
            "valid_profiles": 0,
            "total_students": 0,
            "missing_links": 0,
            "profile_not_found": 0,
            "network_errors": 0,
            "invalid_urls": 0,
            "issues_count": 0,
            "issues_list": [],
            "source_status": "AVAILABLE"
        }
        
    issues_list = []
    valid_count = 0
    missing_links_count = 0
    profile_not_found_count = 0
    network_errors_count = 0
    invalid_urls_count = 0

    for s in students:
        dept_code = s.department.code if s.department else (s.department.name if s.department else "CSE")
        stats = s.stats
        
        username = (s.username or "").strip()
        url = (s.leetcode_url or "").strip()
        
        status = "VALID_PROFILE"
        issue_desc = "Verified Handle & Record"
        action_req = "Verified Record"
        
        if not username and not url:
            status = "MISSING_USERNAME"
            issue_desc = "Missing LeetCode Username & Link"
            action_req = "Assign LeetCode Handle"
            missing_links_count += 1
        elif url and ("leetcode.com" in url) and ("/u/" not in url and "leetcode.com/" not in url):
            status = "INVALID_PROFILE_URL"
            issue_desc = "Invalid URL Syntax"
            action_req = "Fix Profile Link Syntax"
            invalid_urls_count += 1
        elif stats and (stats.error_code == "PROFILE_NOT_FOUND" or stats.status == "PROFILE NOT FOUND" or stats.sync_status == "failed_404"):
            status = "PROFILE_NOT_FOUND"
            issue_desc = "LeetCode Profile Not Found (404)"
            action_req = "Verify Username on LeetCode"
            profile_not_found_count += 1
        elif stats and (stats.error_code in ("NETWORK_TIMEOUT", "FETCH_ERROR") or stats.sync_status == "failed_network"):
            status = "NETWORK_ERROR"
            issue_desc = "Sync Network / Timeout Error"
            action_req = "Retry Profile Sync"
            network_errors_count += 1
        elif stats and stats.validation_status == "identity_mismatch":
            status = "INVALID_PROFILE_URL"
            issue_desc = "Identity Mismatch"
            action_req = "Audit Student Identity"
            invalid_urls_count += 1
        else:
            valid_count += 1

        issues_list.append({
            "reg_no": s.reg_no or f"ID-{s.id}",
            "name": s.name,
            "dept": dept_code,
            "year": s.year_level or "III",
            "status": status,
            "issue": issue_desc,
            "action_required": action_req
        })

    # Sort so action-required items appear at the top, followed by verified valid profiles
    issues_list.sort(key=lambda x: 0 if x["status"] != "VALID_PROFILE" else 1)

    score = int((valid_count / total) * 100) if total > 0 else 100

    return {
        "health_score_percentage": score,
        "valid_profiles": valid_count,
        "total_students": total,
        "missing_links": missing_links_count,
        "profile_not_found": profile_not_found_count,
        "network_errors": network_errors_count,
        "invalid_urls": invalid_urls_count,
        "issues_count": len([i for i in issues_list if i["status"] != "VALID_PROFILE"]),
        "issues_list": issues_list,
        "source_status": "AVAILABLE"
    }

from backend.services.high_concurrency_cache import global_response_cache

@router.get("/performance-chart")
def get_performance_chart(
    timeframe: str = Query("monthly"),
    department: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    batch: Optional[str] = None,
    section_id: Optional[int] = None,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else 0
    cache_key = f"perf_chart:{timeframe}:{department}:{dept_id}:{year_level}:{batch}:{section_id}:{custom_start}:{custom_end}:{user_id}"
    cached_res = global_response_cache.get(cache_key)
    if cached_res:
        return cached_res

    start_dt, end_dt = resolve_date_range(timeframe, custom_start, custom_end)
    
    # Base query for authorized students
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    
    # Resolve Department by ID or Code/Name
    target_dept_id = dept_id
    if not target_dept_id and department and department.upper() not in ("", "ALL"):
        if str(department).isdigit():
            target_dept_id = int(department)
        else:
            dept_obj = db.query(Department).filter(
                or_(
                    func.upper(Department.code) == department.upper(),
                    func.upper(Department.name) == department.upper()
                )
            ).first()
            if dept_obj:
                target_dept_id = dept_obj.id

    if target_dept_id:
        base_student_query = base_student_query.filter(Student.department_id == target_dept_id)
        
    if year_level and year_level.upper() not in ("", "ALL"):
        cleaned_year = year_level.upper().replace(" YEAR", "").replace("YR", "").strip()
        base_student_query = base_student_query.filter(func.upper(Student.year_level) == cleaned_year)
        
    if batch and batch.upper() not in ("", "ALL"):
        base_student_query = base_student_query.filter(Student.batch == batch)

    if section_id:
        base_student_query = base_student_query.filter(Student.section_id == section_id)
        
    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)
        
    student_subquery = base_student_query.subquery()
    
    date_col = func.date(StudentStatSnapshot.captured_at).label("date")
    trend_aggregates = db.query(
        date_col,
        func.sum(StudentStatSnapshot.total_solved).label("problemsSolved"),
        func.count(func.distinct(StudentStatSnapshot.student_id)).label("activeStudents")
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= start_dt,
        StudentStatSnapshot.captured_at <= end_dt
    ).group_by(date_col).order_by(date_col.asc()).all()
    
    db_perf_map = {}
    for row in trend_aggregates:
        db_perf_map[str(row.date)] = {
            "problemsSolved": int(row.problemsSolved) if row.problemsSolved and int(row.problemsSolved) > 0 else None,
            "activeStudents": int(row.activeStudents) if row.activeStudents and int(row.activeStudents) > 0 else None
        }

    # Generate full daily sequence
    start_date = start_dt.date()
    end_date = end_dt.date()
    total_days = max(1, (end_date - start_date).days + 1)
    daily_dates = [start_date + datetime.timedelta(days=i) for i in range(total_days)]

    raw_perf = []
    last_p_solved = None
    last_p_active = None

    # First pass: forward fill
    for d in daily_dates:
        d_str = d.strftime("%Y-%m-%d")
        item = db_perf_map.get(d_str)

        p_solv = item["problemsSolved"] if item and item["problemsSolved"] is not None else None
        p_act = item["activeStudents"] if item and item["activeStudents"] is not None else None

        if p_solv is not None:
            last_p_solved = p_solv
        else:
            p_solv = last_p_solved

        if p_act is not None:
            last_p_active = p_act
        else:
            p_act = last_p_active

        raw_perf.append({
            "date": d_str,
            "problemsSolved": p_solv,
            "activeStudents": p_act
        })

    # Second pass: back fill
    first_v_solved = next((t["problemsSolved"] for t in raw_perf if t["problemsSolved"] is not None), 0)
    first_v_active = next((t["activeStudents"] for t in raw_perf if t["activeStudents"] is not None), 0)

    data = []
    for t in raw_perf:
        solv_final = t["problemsSolved"] if t["problemsSolved"] is not None else first_v_solved
        act_final = t["activeStudents"] if t["activeStudents"] is not None else first_v_active
        data.append({
            "label": t["date"],
            "date": t["date"],
            "problemsSolved": solv_final,
            "activeStudents": act_final
        })


    # Calculate Previous Period Comparison for Growth Rate
    duration = end_dt - start_dt
    prev_start_dt = start_dt - duration
    prev_end_dt = start_dt - datetime.timedelta(microseconds=1)
    
    prev_solved_sum = db.query(
        func.sum(StudentStatSnapshot.total_solved)
    ).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id)),
        StudentStatSnapshot.captured_at >= prev_start_dt,
        StudentStatSnapshot.captured_at <= prev_end_dt
    ).scalar() or 0

    curr_total_solved = sum(item["problemsSolved"] for item in data)
    period_growth: Optional[float] = None
    if prev_solved_sum > 0:
        period_growth = round(((curr_total_solved - prev_solved_sum) / float(prev_solved_sum)) * 100.0, 1)

    peak_solved = max((item["problemsSolved"] for item in data), default=0)
    peak_active = max((item["activeStudents"] for item in data), default=0)
    
    most_active_date = None
    if data:
        most_active_item = max(data, key=lambda item: item["problemsSolved"])
        most_active_date = most_active_item["date"]
        
    # Get last updated timestamp
    last_snapshot = db.query(func.max(StudentStatSnapshot.captured_at)).filter(
        StudentStatSnapshot.student_id.in_(db.query(student_subquery.c.id))
    ).scalar()
    
    data_as_of = last_snapshot.isoformat() if last_snapshot else None

    res_dict = {
        "data": data,
        "metrics": {
            "peak_solved": peak_solved,
            "peak_active": peak_active,
            "most_active_date": most_active_date,
            "period_growth": period_growth,
            "previous_period_solved": int(prev_solved_sum)
        },
        "data_as_of": data_as_of,
        "scope": {
            "timeframe": timeframe,
            "department": department or target_dept_id,
            "year_level": year_level
        }
    }
    global_response_cache.set(cache_key, res_dict, ttl_seconds=5.0)
    return res_dict


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
