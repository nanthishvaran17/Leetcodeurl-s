from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio

try:
    from zoneinfo import ZoneInfo
    def get_tz(tz_name):
        return ZoneInfo(tz_name)
except ImportError:
    import pytz
    def get_tz(tz_name):
        return pytz.timezone(tz_name)

from backend.config import settings
from backend.database import SessionLocal
from backend.session_tracker import get_or_create_current_session, trigger_start_snapshot, trigger_end_snapshot
try:
    from backend.excel_handler import generate_8_sheet_excel_report
    EXCEL_AVAILABLE = True
except Exception as e:
    EXCEL_AVAILABLE = False
    generate_8_sheet_excel_report = None
    logger_placeholder = None

try:
    from backend.pdf_generator import generate_pdf_summary_report
    PDF_AVAILABLE = True
except Exception:
    PDF_AVAILABLE = False
    generate_pdf_summary_report = None

from backend.email_service import send_weekly_report_email
from backend.routes.students import _bg_refresh_all_students
from backend.logger import logger

tz = get_tz(settings.TIMEZONE)
scheduler = AsyncIOScheduler(timezone=tz)

async def sunday_start_job():
    """
    Scheduled for Sunday 8:00 AM IST: Baseline snapshot.
    """
    logger.info("Executing Scheduled Job: Sunday 8:00 AM Start Snapshot...")
    db = SessionLocal()
    try:
        session = get_or_create_current_session(db)
        await trigger_start_snapshot(db, session.id)
    except Exception as e:
        logger.error(f"Error in sunday_start_job: {e}")
    finally:
        db.close()

async def sunday_end_job():
    """
    Scheduled for Sunday 9:30 AM IST: End snapshot, ranking calculation, report generation & email dispatch.
    """
    logger.info("Executing Scheduled Job: Sunday 9:30 AM End Snapshot...")
    db = SessionLocal()
    try:
        session = get_or_create_current_session(db)
        await trigger_end_snapshot(db, session.id)

        # Generate reports (skip if numpy/pandas not available)
        excel_bytes = generate_8_sheet_excel_report(db) if EXCEL_AVAILABLE else None
        matrix_bytes = None  # Optional feature
        pdf_bytes = generate_pdf_summary_report(db) if PDF_AVAILABLE else None

        # Email list
        recipients = [e.strip() for e in settings.REPORT_RECIPIENT_EMAILS.split(",") if e.strip()]
        if recipients:
            subject = f"Weekly LeetCode Session Report – Week {session.week_number} ({session.session_date})"
            body = f"""
            <h2>College LeetCode Weekly Performance Summary</h2>
            <p>Dear Faculty / HOD,</p>
            <p>The weekly Sunday LeetCode session (08:00 AM – 09:30 AM IST) for <b>{session.session_date}</b> has been completed.</p>
            <p>Please find attached the detailed 8-Sheet Excel Report and PDF Summary Report.</p>
            <br/>
            <p>Regards,<br/><b>LeetCode Automated Tracking Platform</b></p>
            """
            send_weekly_report_email(
                db=db,
                recipient_emails=recipients,
                subject=subject,
                body_html=body,
                excel_bytes=excel_bytes,
                pdf_bytes=pdf_bytes,
                session_id=session.id
            )
    except Exception as e:
        logger.error(f"Error in sunday_end_job: {e}")
    finally:
        db.close()

async def daily_auto_refresh_job():
    """
    Scheduled daily: Auto-syncs live LeetCode stats for all active students.
    """
    logger.info("Executing Scheduled Job: Daily Live Stats Sync with LeetCode...")
    try:
        await _bg_refresh_all_students()
        logger.info("Daily Live Stats Sync completed successfully.")
    except Exception as e:
        logger.error(f"Error in daily_auto_refresh_job: {e}")

def start_scheduler():
    """
    Starts the APScheduler cron jobs.
    """
    # Cron for Sunday 8:00 AM IST (day_of_week=6 is Sunday)
    scheduler.add_job(
        sunday_start_job,
        CronTrigger(day_of_week='sun', hour=8, minute=0, timezone=tz),
        id='sunday_start_snapshot',
        replace_existing=True
    )

    # Cron for Sunday 9:30 AM IST
    scheduler.add_job(
        sunday_end_job,
        CronTrigger(day_of_week='sun', hour=9, minute=30, timezone=tz),
        id='sunday_end_snapshot',
        replace_existing=True
    )

    # Daily Auto-Refresh Cron: Runs every day at 00:00 AM IST and 12:00 PM IST
    scheduler.add_job(
        daily_auto_refresh_job,
        CronTrigger(hour='0,12', minute=0, timezone=tz),
        id='daily_auto_refresh_stats',
        replace_existing=True
    )

    scheduler.start()
    logger.info("APScheduler started: Sunday jobs (08:00 AM & 09:30 AM) + Daily Auto-Sync (00:00 & 12:00 IST) registered.")

