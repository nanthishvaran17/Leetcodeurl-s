import datetime
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import WeeklySessionSnapshot, Student, LeetCodeProfileStats, Department, Section
from backend.schemas import WeeklySessionOut, DashboardSummary
from backend.session_tracker import get_or_create_current_session
from backend.cache import cache

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.get("/current", response_model=WeeklySessionOut)
def get_current_session_info(db: Session = Depends(get_db)):
    return get_or_create_current_session(db)

from backend.security import get_current_user_optional
from backend.services.authorization_service import apply_role_based_student_filter

@router.get("/dashboard-summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db), current_user = Depends(get_current_user_optional)):
    from sqlalchemy import func
    
    user_id = current_user.id if current_user else "public"
    cache_key = f"dashboard_summary_{user_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # 1. Base query with Role-Based Scoping
    base_student_query = db.query(Student.id).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if current_user:
        base_student_query = apply_role_based_student_filter(base_student_query, current_user, db)
    
    total_students = base_student_query.count()
    
    total_departments = db.query(func.count(Department.id)).scalar() or 0
    total_sections = db.query(func.count(Section.id)).scalar() or 0

    current_session = get_or_create_current_session(db)

    # 2. Strict Mathematical Sync State Invariants (Mutually Exclusive)
    verified = db.query(func.count(Student.id)).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
        .filter(Student.id.in_(base_student_query))\
        .filter(LeetCodeProfileStats.sync_status.in_(['success', 'OK', 'verified'])).scalar() or 0

    no_username = db.query(func.count(Student.id)).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
        .filter(Student.id.in_(base_student_query))\
        .filter(
            (Student.username == None) | 
            (Student.username == "") | 
            (LeetCodeProfileStats.sync_status == "pending_username") | 
            (LeetCodeProfileStats.status == "MISSING LINK")
        ).scalar() or 0

    failed = db.query(func.count(Student.id)).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
        .filter(Student.id.in_(base_student_query))\
        .filter(Student.username != None, Student.username != "")\
        .filter(LeetCodeProfileStats.sync_status.in_(['failed', 'mismatch', 'TIMEOUT', 'IDENTITY_MISMATCH', 'INVALID_USERNAME'])).scalar() or 0

    pending = total_students - (verified + no_username + failed)
    if pending < 0: pending = 0

    # 3. Performance Aggregations
    agg_result = db.query(
        func.sum(LeetCodeProfileStats.total_solved).label("total_problems"),
        func.max(LeetCodeProfileStats.contest_rating).label("highest_rating"),
        func.count(LeetCodeProfileStats.id).filter(LeetCodeProfileStats.total_solved > 0).label("active_students")
    ).select_from(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)\
     .filter(Student.id.in_(base_student_query)).first()

    total_problems = int(agg_result.total_problems) if agg_result and agg_result.total_problems else 0
    highest_rating = float(agg_result.highest_rating) if agg_result and agg_result.highest_rating else 0.0
    active_students = int(agg_result.active_students) if agg_result and agg_result.active_students else 0
    
    # 4. Top ranker
    top_college_ranker = None
    top_student = db.query(Student.name).join(LeetCodeProfileStats).filter(Student.id.in_(base_student_query)).order_by(LeetCodeProfileStats.total_solved.desc().nullslast()).first()
    if top_student:
        top_college_ranker = top_student[0]

    avg_solved = round(total_problems / max(total_students, 1), 1)
    
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

    # 5. Check if Sync Engine is running via SyncJob table
    from backend.models import SyncJob
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    is_running = running_job is not None
    processed = running_job.processed_count if running_job else 0
    total = running_job.total_records if running_job else total_students
    percentage = round((processed / max(total, 1)) * 100, 2) if is_running else 0.0

    resp = {
        "scope": {
            "total_students": total_students,
            "total_departments": total_departments,
            "total_sections": total_sections
        },
        "sync": {
            "is_running": is_running,
            "processed": processed,
            "total": total,
            "percentage": percentage
        },
        "verification": {
            "verified": verified,
            "pending": pending,
            "failed": failed,
            "no_username": no_username
        },
        "performance": {
            "total_problems_solved": total_problems,
            "active_students": active_students,
            "average_problems_solved": avg_solved,
            "average_weekly_progress": avg_progress,
            "highest_contest_rating": highest_rating,
            "top_college_ranker": top_college_ranker
        },
        "session": {
            "current_session": WeeklySessionOut.model_validate(current_session) if current_session else None,
            "is_session_live": is_session_live,
            "session_phase": session_phase,
            "next_session_countdown_seconds": max(countdown_sec, 0)
        }
    }
    cache.set(cache_key, resp, ttl_seconds=60, tags=["sessions", "students", "dashboard"])
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
