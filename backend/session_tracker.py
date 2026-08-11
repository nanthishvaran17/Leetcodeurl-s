import datetime
from sqlalchemy.orm import Session
from backend.models import WeeklySession, WeeklySessionSnapshot, Student, LeetCodeProfileStats
from backend.leetcode_client import fetch_leetcode_profile
from backend.sync_engine import sync_single_student_db
from backend.ranking import update_all_rankings_and_badges
from backend.config import settings
from backend.logger import logger

def get_or_create_current_session(db: Session) -> WeeklySession:
    """
    Retrieves or creates the active/upcoming session for the current date.
    """
    today_str = datetime.date.today().isoformat()
    session = db.query(WeeklySession).filter(WeeklySession.session_date == today_str).first()
    
    if not session:
        # Determine week number of year
        week_num = datetime.date.today().isocalendar()[1]
        session = WeeklySession(
            academic_year="2026-27",
            week_number=week_num,
            session_date=today_str,
            start_time=settings.SESSION_START,
            end_time=settings.SESSION_END,
            status="UPCOMING"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Created new WeeklySession ID={session.id} for date {today_str}")
        
    return session

async def trigger_start_snapshot(db: Session, session_id: int):
    """
    Executed at 8:00 AM IST: Takes baseline snapshot of all students' current solved counts.
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session:
        logger.error(f"Session ID {session_id} not found.")
        return

    session.status = "ACTIVE"
    db.commit()
    logger.info(f"Starting 8:00 AM Baseline Snapshot for Session ID {session_id}...")

    students = db.query(Student).filter(Student.is_active == True).all()

    for student in students:
        # Fetch current profile stats (using cached if fresh or update)
        stats_dict = await fetch_leetcode_profile(student.leetcode_url)
        
        # Update student profile stats in DB using centralized sync_single_student_db
        sync_single_student_db(student.id, stats_dict, db)

        # Create baseline snapshot record
        snapshot = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.session_id == session_id,
            WeeklySessionSnapshot.student_id == student.id
        ).first()

        if not snapshot:
            snapshot = WeeklySessionSnapshot(
                session_id=session_id,
                student_id=student.id
            )
            db.add(snapshot)

        snapshot.start_solved_count = student.stats.total_solved if student.stats else 0
        snapshot.start_rating = student.stats.contest_rating if student.stats else None
        snapshot.status = "UPCOMING"
        
    db.commit()
    logger.info("8:00 AM Baseline Snapshot completed successfully!")

async def trigger_end_snapshot(db: Session, session_id: int):
    """
    Executed at 9:30 AM IST: Takes final snapshot, calculates progress & status (STARTED / NOT STARTED / DATA UNAVAILABLE).
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session:
        logger.error(f"Session ID {session_id} not found.")
        return

    logger.info(f"Starting 9:30 AM Final Snapshot for Session ID {session_id}...")

    students = db.query(Student).filter(Student.is_active == True).all()

    for student in students:
        # Fetch fresh data from LeetCode
        stats_dict = await fetch_leetcode_profile(student.leetcode_url)

        snapshot = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.session_id == session_id,
            WeeklySessionSnapshot.student_id == student.id
        ).first()

        if not snapshot:
            snapshot = WeeklySessionSnapshot(
                session_id=session_id,
                student_id=student.id,
                start_solved_count=student.stats.total_solved if student.stats else 0
            )
            db.add(snapshot)

        sync_single_student_db(student.id, stats_dict, db)
        is_ok = stats_dict.get("status") in ["OK", "success"]

        if is_ok:
            end_solved = stats_dict["total_solved"]
            end_rating = stats_dict["contest_rating"]
            
            snapshot.end_solved_count = end_solved
            snapshot.end_rating = end_rating
            
            # Progress calculation
            progress = end_solved - snapshot.start_solved_count
            if progress < 0:
                progress = 0
            snapshot.problems_added = progress

            if snapshot.start_rating and end_rating:
                snapshot.rating_change = round(end_rating - snapshot.start_rating, 1)

            # Assign Status based on progress threshold
            if progress >= settings.PROGRESS_THRESHOLD:
                snapshot.status = "STARTED"
            else:
                snapshot.status = "NOT STARTED"
        else:
            snapshot.status = "DATA UNAVAILABLE"

    session.status = "COMPLETED"
    session.completed_at = datetime.datetime.utcnow()
    db.commit()

    logger.info("9:30 AM Final Snapshot completed!")

    # Recalculate rankings & badges
    update_all_rankings_and_badges(db, week_number=session.week_number, academic_year=session.academic_year)
