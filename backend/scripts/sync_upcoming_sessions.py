"""
sync_upcoming_sessions.py
Automated script to discover, calculate, and provision upcoming Weekly Contest sessions
dynamically into the database.
Ensures contests like Weekly Contest 521, 522, 523, ... 570+ are seamlessly tracked.
"""
import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import WeeklySession, Student
from backend.services.contest_discovery import calculate_contest_number, get_current_ist_datetime, IST_TZ
from backend.logger import logger

def sync_upcoming_weekly_sessions(num_future_weeks: int = 52) -> int:
    db: Session = SessionLocal()
    added_count = 0
    try:
        now_ist = get_current_ist_datetime()
        start_sunday = datetime.date(2026, 8, 9)  # Contest 514
        active_roster_count = db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).count()

        # Provision for 52 weeks into the future
        current_date = start_sunday
        end_date = now_ist.date() + datetime.timedelta(weeks=num_future_weeks)

        existing_codes = {
            s.session_code for s in db.query(WeeklySession.session_code).all() if s.session_code
        }
        existing_names = {
            s.contest_name.lower().strip() for s in db.query(WeeklySession.contest_name).all() if s.contest_name
        }

        while current_date <= end_date:
            contest_num = calculate_contest_number(current_date)
            session_code = f"WEEK-{current_date.strftime('%Y-%m-%d')}"
            contest_name = f"Weekly Contest {contest_num}"
            date_str = current_date.strftime("%d.%m.%Y")
            contest_id = f"weekly-contest-{contest_num}"

            if session_code not in existing_codes and contest_name.lower().strip() not in existing_names:
                status = "FINALIZED" if current_date < now_ist.date() else "SCHEDULED"
                new_session = WeeklySession(
                    academic_year="2026-27",
                    week_number=current_date.isocalendar()[1],
                    session_code=session_code,
                    session_date=date_str,
                    contest_id=contest_id,
                    contest_name=contest_name,
                    start_time="08:00",
                    end_time="09:30",
                    status=status,
                    total_students=active_roster_count
                )
                db.add(new_session)
                added_count += 1
                existing_codes.add(session_code)
                existing_names.add(contest_name.lower().strip())

            current_date += datetime.timedelta(days=7)

        db.commit()
        logger.info(f"[SUCCESS] Provisioned {added_count} upcoming Weekly Contest sessions dynamically.")
        return added_count
    except Exception as e:
        db.rollback()
        logger.error(f"[ERROR] Failed to sync upcoming weekly sessions: {e}", exc_info=True)
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    count = sync_upcoming_weekly_sessions(52)
    print(f"Successfully provisioned {count} upcoming contest sessions in the database.")
