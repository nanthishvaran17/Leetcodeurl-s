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

    students = db.query(Student).options(
        joinedload(Student.stats)
    ).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    total_students = len(students)
    total_departments = db.query(Department).count()
    total_sections = db.query(Section).count()

    current_session = get_or_create_current_session(db)

    active_students = 0
    not_started_students = 0
    total_problems = 0
    highest_rating = None
    top_college_ranker = None

    if students:
        total_problems = sum((s.stats.total_solved or 0) if s.stats else 0 for s in students)
        ratings = [s.stats.contest_rating for s in students if s.stats and s.stats.contest_rating]
        if ratings:
            highest_rating = max(ratings)

        sorted_s = sorted(
            students,
            key=lambda x: (x.stats.total_solved or 0) if x.stats else 0,
            reverse=True
        )
        if sorted_s:
            top_college_ranker = sorted_s[0].name

    active_students = sum(1 for s in students if s.stats and (s.stats.total_solved or 0) > 0)
    not_started_students = total_students - active_students

    avg_solved = round(total_problems / total_students, 1) if total_students > 0 else 0.0
    
    avg_progress = 0.0
    if current_session:
        snaps = db.query(WeeklySessionSnapshot).filter(WeeklySessionSnapshot.session_id == current_session.id).all()
        if snaps and len(snaps) > 0:
            avg_progress = round(sum(sn.problems_added for sn in snaps) / len(snaps), 1)
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

    verified_profiles = sum(1 for s in students if s.stats and (s.stats.total_solved is not None or s.stats.sync_status in ('success', 'OK', 'verified', 'stale')))
    pending_sync = sum(1 for s in students if not s.stats or (s.stats.sync_status in ('pending', 'not_started') and s.stats.total_solved is None))
    failed_sync = sum(1 for s in students if s.stats and s.stats.sync_status == 'failed' and s.stats.total_solved is None)

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
        "current_session": WeeklySessionOut.from_orm(current_session) if current_session else None,
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
