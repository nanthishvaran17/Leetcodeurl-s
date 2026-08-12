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
    session.baseline_snapshot_id = f"baseline_{session_id}"
    db.commit()
    logger.info(f"Starting 8:00 AM Baseline Snapshot for Session ID {session_id}...")

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    session.total_students = len(students)
    db.commit()

    for student in students:
        # Fetch current profile stats
        stats_dict = await fetch_leetcode_profile(student.leetcode_url)
        sync_single_student_db(student.id, stats_dict, db)

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

        is_verified = student.stats and student.stats.sync_status in ("success", "OK")
        
        snapshot.start_solved_count = student.stats.total_solved if is_verified else None
        snapshot.start_rating = student.stats.contest_rating if is_verified else None
        snapshot.status = "UPCOMING"
        
    db.commit()
    logger.info("8:00 AM Baseline Snapshot completed successfully!")

async def trigger_end_snapshot(db: Session, session_id: int):
    """
    Executed at 9:30 AM IST: Takes final snapshot, calculates progress ONLY on verified records.
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session:
        logger.error(f"Session ID {session_id} not found.")
        return

    session.final_snapshot_id = f"final_{session_id}"
    logger.info(f"Starting 9:30 AM Final Snapshot for Session ID {session_id}...")

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    
    official_count = 0
    virtual_count = 0
    not_participated = 0
    failed_count = 0

    for student in students:
        stats_dict = await fetch_leetcode_profile(student.leetcode_url)
        
        snapshot = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.session_id == session_id,
            WeeklySessionSnapshot.student_id == student.id
        ).first()

        if not snapshot:
            snapshot = WeeklySessionSnapshot(
                session_id=session_id,
                student_id=student.id,
                start_solved_count=None
            )
            db.add(snapshot)

        sync_single_student_db(student.id, stats_dict, db)
        is_ok = stats_dict.get("validation_status") == "verified"

        # Determine Participation for session summary
        # We look at recent_contest_type if contest happened recently, or from contest_participations
        c_type = stats_dict.get("recent_contest_type", "UNKNOWN")
        if c_type == "OFFICIAL":
            official_count += 1
        elif c_type == "VIRTUAL":
            virtual_count += 1
        elif is_ok:
            not_participated += 1
        else:
            failed_count += 1

        if is_ok:
            end_solved = stats_dict.get("total_solved")
            end_rating = stats_dict.get("contest_rating")
            
            snapshot.end_solved_count = end_solved
            snapshot.end_rating = end_rating
            
            # Progress calculation ONLY when BOTH baseline and final are verified
            if snapshot.start_solved_count is not None and end_solved is not None:
                progress = end_solved - snapshot.start_solved_count
                snapshot.problems_added = max(0, progress)
                
                if progress >= settings.PROGRESS_THRESHOLD:
                    snapshot.status = "STARTED"
                else:
                    snapshot.status = "NOT STARTED"
            else:
                snapshot.status = "DATA UNAVAILABLE"
                snapshot.problems_added = 0

            if snapshot.start_rating is not None and end_rating is not None:
                snapshot.rating_change = round(end_rating - snapshot.start_rating, 1)
        else:
            snapshot.status = "DATA UNAVAILABLE"
            snapshot.end_solved_count = None
            snapshot.end_rating = None
            snapshot.problems_added = 0

    session.official_participants = official_count
    session.virtual_participants = virtual_count
    session.not_participated = not_participated
    session.failed_verification = failed_count
    session.status = "COMPLETED"
    session.completed_at = datetime.datetime.utcnow()
    db.commit()

    logger.info("9:30 AM Final Snapshot completed!")

    # Recalculate rankings & badges
    update_all_rankings_and_badges(db, week_number=session.week_number, academic_year=session.academic_year)

    # Sync fresh calculations to Firestore
    try:
        from backend.assets.sync_firestore import sync_database_to_firestore
        sync_database_to_firestore()
    except Exception as fs_err:
        logger.warning(f"Post-session Firestore sync note: {fs_err}")

