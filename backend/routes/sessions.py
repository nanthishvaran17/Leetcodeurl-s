import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from backend.database import get_db
from backend.models import WeeklySession, WeeklySessionSnapshot, Student, LeetCodeProfileStats, Department, Section
from backend.schemas import WeeklySessionOut, DashboardSummary
from backend.session_tracker import get_or_create_current_session, trigger_start_snapshot, trigger_end_snapshot
from backend.config import settings

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.get("/current", response_model=WeeklySessionOut)
def get_current_session_info(db: Session = Depends(get_db)):
    return get_or_create_current_session(db)

from backend.cache import cache

@router.get("/dashboard-summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    cache_key = "sessions:dashboard_summary"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    from sqlalchemy import func
    
    # 1. Total counts
    total_students = db.query(func.count(Student.id)).filter((Student.is_active == True) | (Student.is_active.is_(None))).scalar() or 0
    total_departments = db.query(func.count(Department.id)).scalar() or 0
    total_sections = db.query(func.count(Section.id)).scalar() or 0

    current_session = get_or_create_current_session(db)

    # 2. Student aggregations using single SQL query
    agg_result = db.query(
        func.sum(LeetCodeProfileStats.total_solved).label("total_problems"),
        func.max(LeetCodeProfileStats.contest_rating).label("highest_rating"),
        func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.total_solved > 0).label("active_students"),
        func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.sync_status.in_(['success', 'OK', 'verified', 'stale']) & (LeetCodeProfileStats.total_solved > 0)).label("verified_profiles"),
        func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.sync_status.in_(['pending', 'not_started']) | (LeetCodeProfileStats.total_solved == 0)).label("pending_sync"),
        func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.sync_status.in_(['failed', 'mismatch', 'MISSING LINK'])).label("failed_sync")
    ).select_from(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
     .filter((Student.is_active == True) | (Student.is_active.is_(None))).first()

    total_problems = int(agg_result.total_problems) if agg_result and agg_result.total_problems else 0
    highest_rating = float(agg_result.highest_rating) if agg_result and agg_result.highest_rating else None
    active_students = int(agg_result.active_students) if agg_result and agg_result.active_students else 0
    
    verified_profiles = int(agg_result.verified_profiles) if agg_result and agg_result.verified_profiles else 0
    pending_sync_stats = int(agg_result.pending_sync) if agg_result and agg_result.pending_sync else 0
    failed_sync = int(agg_result.failed_sync) if agg_result and agg_result.failed_sync else 0
    
    # Calculate students with missing stats completely
    stats_count = db.query(func.count(LeetCodeProfileStats.id)).select_from(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id).filter((Student.is_active == True) | (Student.is_active.is_(None)), LeetCodeProfileStats.id.isnot(None)).scalar() or 0
    missing_stats_count = total_students - stats_count
    pending_sync = pending_sync_stats + missing_stats_count
    
    not_started_students = total_students - active_students

    # 3. Top ranker
    top_college_ranker = None
    top_student = db.query(Student.name).join(LeetCodeProfileStats).filter((Student.is_active == True) | (Student.is_active.is_(None))).order_by(LeetCodeProfileStats.total_solved.desc().nullslast()).first()
    if top_student:
        top_college_ranker = top_student[0]

    avg_solved = round(total_problems / total_students, 1) if total_students > 0 else 0.0
    
    avg_progress = 0.0
    if current_session:
        snaps_agg = db.query(
            func.sum(WeeklySessionSnapshot.problems_added),
            func.count(WeeklySessionSnapshot.id)
        ).filter(WeeklySessionSnapshot.session_id == current_session.id).first()
        
        if snaps_agg and snaps_agg[1] and snaps_agg[1] > 0:
            avg_progress = round((snaps_agg[0] or 0) / snaps_agg[1], 1)
        else:
            avg_progress = round(total_problems / max(total_students, 1), 1)

    from backend.services.contest_discovery import get_current_ist_datetime
    now_ist = get_current_ist_datetime()
    is_sunday = (now_ist.weekday() == 6)
    
    start_dt = now_ist.replace(hour=8, minute=0, second=0, microsecond=0)
    end_dt = now_ist.replace(hour=9, minute=30, second=0, microsecond=0)

    if is_sunday and start_dt <= now_ist <= end_dt:
        is_session_live = True
        countdown_sec = int((end_dt - now_ist).total_seconds())
        session_phase = "LIVE_NOW"
    elif is_sunday and now_ist < start_dt:
        is_session_live = False
        countdown_sec = int((start_dt - now_ist).total_seconds())
        session_phase = "SCHEDULED_TODAY"
    else:
        is_session_live = False
        days_until_sunday = (6 - now_ist.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        next_sunday = (now_ist + datetime.timedelta(days=days_until_sunday)).replace(hour=8, minute=0, second=0, microsecond=0)
        countdown_sec = int((next_sunday - now_ist).total_seconds())
        session_phase = "SCHEDULED_NEXT_WEEK"



    resp = {
        "total_students": int(total_students),
        "total_departments": int(total_departments),
        "total_sections": int(total_sections),
        "active_students": int(active_students),
        "not_started_students": int(not_started_students),
        "total_problems_solved": int(total_problems),
        "average_problems_solved": float(avg_solved),
        "average_weekly_progress": float(avg_progress),
        "highest_contest_rating": float(highest_rating) if highest_rating is not None else 0.0,
        "top_college_ranker": str(top_college_ranker) if top_college_ranker else "N/A",
        "current_session": WeeklySessionOut.model_validate(current_session) if current_session else None,
        "is_session_live": is_session_live,
        "session_phase": session_phase,
        "next_session_countdown_seconds": int(max(countdown_sec, 0)),
        "verified_profiles": int(verified_profiles),
        "pending_sync": int(pending_sync),
        "failed_sync": int(failed_sync)
    }
    cache.set(cache_key, resp, ttl_seconds=60, tags=["sessions", "students"])
    return resp

@router.post("/trigger-start")
async def trigger_session_start(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from backend.services.weekly_session_manager import trigger_start_snapshot_0800
    session = get_or_create_current_session(db)
    background_tasks.add_task(trigger_start_snapshot_0800, db, session.id)
    return {"message": "Session start (8:00 AM baseline snapshot) triggered in background.", "session_id": session.id}

@router.post("/trigger-end")
async def trigger_session_end(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from backend.services.weekly_session_manager import trigger_final_snapshot_0930
    session = get_or_create_current_session(db)
    background_tasks.add_task(trigger_final_snapshot_0930, db, session.id)
    return {"message": "Session end (9:30 AM snapshot & progress evaluation) triggered in background.", "session_id": session.id}
