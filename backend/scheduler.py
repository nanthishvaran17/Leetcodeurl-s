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

from backend.sync_engine import run_batch_sync
from backend.logger import logger

from backend.services.weekly_session_manager import (
    get_or_create_current_weekly_session,
    trigger_start_snapshot_0800,
    trigger_final_snapshot_0930,
    run_live_polling_cycle,
    resume_active_weekly_session
)

tz = get_tz(settings.TIMEZONE)
scheduler = AsyncIOScheduler(timezone=tz)

async def sunday_start_job():
    """
    Scheduled for Sunday 8:00 AM IST: Baseline snapshot.
    """
    logger.info("Executing Scheduled Job: Sunday 8:00 AM Start Snapshot...")
    db = SessionLocal()
    try:
        session = get_or_create_current_weekly_session(db)
        await trigger_start_snapshot_0800(db, session.id)
    except Exception as e:
        logger.error(f"Error in sunday_start_job: {e}")
    finally:
        db.close()

async def sunday_end_job():
    """
    Scheduled for Sunday 9:30 AM IST: Final snapshot, snapshot lock, report generation & email dispatch.
    """
    logger.info("Executing Scheduled Job: Sunday 9:30 AM End Snapshot...")
    db = SessionLocal()
    try:
        session = get_or_create_current_weekly_session(db)
        snapshot = await trigger_final_snapshot_0930(db, session.id)

        dataset = snapshot.dataset
        verified = dataset.get("metrics", {}).get("officialAttended", 0)
        total = dataset.get("metrics", {}).get("totalStudents", 0)
        
        from backend.exporters.excel_exporter import export_excel_from_dataset
        from backend.exporters.pdf_exporter import export_pdf_from_dataset
        
        excel_bytes = export_excel_from_dataset(dataset)
        pdf_bytes = export_pdf_from_dataset(dataset)

        # Email list
        recipients = [e.strip() for e in settings.REPORT_RECIPIENT_EMAILS.split(",") if e.strip()]
        if recipients:
            subject = f"Weekly LeetCode Session Report – Week {session.week_number} ({session.session_date})"
            body = f"""
            <h2>College LeetCode Weekly Performance Summary</h2>
            <p>Dear Faculty / HOD,</p>
            <p>The weekly Sunday LeetCode session (08:00 AM – 09:30 AM IST) for <b>{session.session_date}</b> has been completed.</p>
            <p>Please find attached the detailed Excel Report and PDF Summary Report generated from verified data.</p>
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

async def sunday_auto_email_job():
    """
    Scheduled for Sunday 9:45 AM IST: Automatically dispatches weekly contest report emails
    to all active DB recipients, 15 minutes after the 9:30 AM final snapshot completes.
    """
    logger.info("Executing Scheduled Job: Sunday 9:45 AM Auto Email Dispatch...")
    db = SessionLocal()
    try:
        import datetime
        from backend.models import WeeklySession
        today_str = datetime.date.today().isoformat()

        # Find today's completed/finalized session
        session = db.query(WeeklySession).filter(
            WeeklySession.session_date == today_str
        ).first()

        if not session:
            logger.warning("Sunday 9:45 AM email: No session found for today. Skipping auto dispatch.")
            return

        if session.status not in ("COMPLETED", "FINALIZED"):
            logger.warning(f"Sunday 9:45 AM email: Session status is '{session.status}', not COMPLETED/FINALIZED. Skipping auto dispatch.")
            return

        # Generate report bytes from the finalized snapshot dataset
        from backend.models import OfficialWeeklySnapshot
        from backend.exporters.excel_exporter import export_excel_from_dataset
        from backend.exporters.pdf_exporter import export_pdf_from_dataset

        snapshot = db.query(OfficialWeeklySnapshot).filter(
            OfficialWeeklySnapshot.session_id == session.id
        ).order_by(OfficialWeeklySnapshot.id.desc()).first()

        if not snapshot or not snapshot.dataset:
            logger.warning("Sunday 9:45 AM email: No finalized snapshot dataset found. Skipping.")
            return

        dataset = snapshot.dataset

        try:
            excel_bytes = export_excel_from_dataset(dataset)
        except Exception as exc:
            logger.error(f"Sunday 9:45 AM email: Excel export failed: {exc}")
            excel_bytes = None

        try:
            pdf_bytes = export_pdf_from_dataset(dataset)
        except Exception as exc:
            logger.error(f"Sunday 9:45 AM email: PDF export failed: {exc}")
            pdf_bytes = None

        # Dispatch to all active recipients via queue system
        from backend.services.email_service import queue_weekly_report_dispatches
        result = queue_weekly_report_dispatches(
            db=db,
            session_id=session.id,
            report_type="WEEKLY_CONTEST_AUTO"
        )
        logger.info(f"Sunday 9:45 AM Auto Email: Dispatch result: {result}")

    except Exception as e:
        logger.error(f"Error in sunday_auto_email_job: {e}")
    finally:
        db.close()


async def daily_auto_refresh_job():
    """
    Scheduled daily: Auto-syncs live LeetCode stats for all active students.
    """
    logger.info("Executing Scheduled Job: Daily Live Stats Sync with LeetCode...")
    try:
        await run_batch_sync()
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

    # Cron for Sunday 9:45 AM IST — Auto Email Dispatch (15 min after final snapshot)
    scheduler.add_job(
        sunday_auto_email_job,
        CronTrigger(day_of_week='sun', hour=9, minute=45, timezone=tz),
        id='sunday_auto_email_945',
        replace_existing=True
    )

    # Periodic Auto-Refresh Cron: Runs every 2 hours all week long to catch live problem solves
    scheduler.add_job(
        daily_auto_refresh_job,
        CronTrigger(hour='*/2', minute='0', timezone=tz),
        id='periodic_2hr_auto_refresh',
        replace_existing=True
    )

    # Periodic Sunday Session Sync: Runs every 15 minutes on Sunday between 08:00 AM and 09:30 AM IST
    scheduler.add_job(
        daily_auto_refresh_job,
        CronTrigger(day_of_week='sun', hour='8,9', minute='0,15,30,45', timezone=tz),
        id='sunday_session_live_15min_refresh',
        replace_existing=True
    )

    scheduler.start()
    logger.info("APScheduler started: Sunday session 15-min live sync + Every 2-Hour 24/7 Auto-Sync + Sunday 9:45 AM Auto Email registered.")

