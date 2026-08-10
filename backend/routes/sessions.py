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

@router.get("/dashboard-summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
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
        total_problems = sum((s.stats.total_solved if s.stats else 0) for s in students)
        ratings = [s.stats.contest_rating for s in students if s.stats and s.stats.contest_rating]
        if ratings:
            highest_rating = max(ratings)

        sorted_s = sorted(students, key=lambda x: (x.stats.total_solved if x.stats else 0), reverse=True)
        if sorted_s:
            top_college_ranker = sorted_s[0].name

    if current_session:
        snapshots = db.query(WeeklySessionSnapshot).filter(WeeklySessionSnapshot.session_id == current_session.id).all()
        if snapshots:
            for sn in snapshots:
                if sn.status == "STARTED" or sn.problems_added > 0:
                    active_students += 1
                else:
                    not_started_students += 1
        else:
            # Fallback based on live student stats
            active_students = sum(1 for s in students if s.stats and s.stats.total_solved > 0)
            not_started_students = total_students - active_students
    else:
        active_students = sum(1 for s in students if s.stats and s.stats.total_solved > 0)
        not_started_students = total_students - active_students

    avg_solved = round(total_problems / total_students, 1) if total_students > 0 else 0.0
    
    # Calculate progress average
    avg_progress = 0.0
    if current_session:
        snaps = db.query(WeeklySessionSnapshot).filter(WeeklySessionSnapshot.session_id == current_session.id).all()
        if snaps and len(snaps) > 0:
            avg_progress = round(sum(sn.problems_added for sn in snaps) / len(snaps), 1)
        else:
            avg_progress = round(total_problems / max(total_students, 1), 1)

    # Next session countdown seconds (Sunday 8:00 AM IST)
    now = datetime.datetime.now()
    days_until_sunday = (6 - now.weekday()) % 7
    if days_until_sunday == 0 and now.hour >= 8:
        days_until_sunday = 7
    next_sunday = (now + datetime.timedelta(days=days_until_sunday)).replace(hour=8, minute=0, second=0, microsecond=0)
    countdown_sec = int((next_sunday - now).total_seconds())

    return {
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
        "current_session": current_session,
        "next_session_countdown_seconds": int(max(countdown_sec, 0))
    }

@router.post("/trigger-start")
async def trigger_session_start(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    session = get_or_create_current_session(db)
    background_tasks.add_task(trigger_start_snapshot, db, session.id)
    return {"message": "Session start (8:00 AM baseline snapshot) triggered in background.", "session_id": session.id}

@router.post("/trigger-end")
async def trigger_session_end(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    session = get_or_create_current_session(db)
    background_tasks.add_task(trigger_end_snapshot, db, session.id)
    return {"message": "Session end (9:30 AM snapshot & progress evaluation) triggered in background.", "session_id": session.id}
