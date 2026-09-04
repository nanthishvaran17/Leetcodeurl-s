import datetime
import zoneinfo
import logging

from backend.database import SessionLocal
from backend.models import WeeklySession
from backend.services.sunday_autopilot import UniversalWeeklyContestAutopilot

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sync_historical")

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

def main():
    db = SessionLocal()
    autopilot = UniversalWeeklyContestAutopilot()
    
    # 514 is Aug 9, 2026
    # Let's define the target historical contests and their start dates.
    historical_contests = [
        (510, datetime.date(2026, 7, 12)),
        (511, datetime.date(2026, 7, 19)),
        (512, datetime.date(2026, 7, 26)),
        (513, datetime.date(2026, 8, 2)),
        (514, datetime.date(2026, 8, 9)),
        (515, datetime.date(2026, 8, 16)),
        (516, datetime.date(2026, 8, 23))
    ]
    
    for contest_num, date_val in historical_contests:
        logger.info(f"Processing Weekly Contest {contest_num} for date {date_val}")
        date_str = date_val.strftime("%Y-%m-%d")
        formatted_date = date_val.strftime("%d.%m.%Y")
        session_code = f"WEEK-{date_str}"
        contest_name = f"Weekly Contest {contest_num}"
        contest_id = f"weekly-contest-{contest_num}"
        
        session = db.query(WeeklySession).filter(WeeklySession.session_code == session_code).first()
        if not session:
            logger.info(f"Creating missing session for {contest_name}")
            session = WeeklySession(
                academic_year="2026-27",
                week_number=date_val.isocalendar()[1],
                session_code=session_code,
                session_date=formatted_date,
                contest_id=contest_id,
                contest_name=contest_name,
                start_time="08:00",
                end_time="09:30",
                status="FINALIZED",
                total_students=1450,
                sync_status="🟢 Verified"
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        else:
            logger.info(f"Session already exists for {contest_name}, ensuring it's finalized.")
            session.status = "FINALIZED"
            db.commit()
            
        logger.info(f"Running reconciliation for {contest_name}")
        # Run finalization which internally uses UniversalContestReconciliationEngine to populate WeeklyPublicResult
        result = autopilot.phase_4_finalization_and_reconciliation(session_id=session.id, db=db)
        logger.info(f"Reconciliation result for {contest_name}: {result['success']}")
        
    db.close()
    logger.info("Historical sync completed.")

if __name__ == "__main__":
    main()
