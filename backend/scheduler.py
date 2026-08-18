import asyncio
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.time_utils import IST, UTC

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

tz = IST
scheduler = AsyncIOScheduler(timezone=IST)

async def sunday_start_job():
    """
    Scheduled for Sunday 8:00 AM IST: Baseline snapshot and live student synchronization.
    """
    logger.info("[SCHEDULER] Sunday sync window detected (08:00 AM – 09:30 AM IST [Asia/Kolkata]). Starting live sync pipeline...")
    db = SessionLocal()
    try:
        session = get_or_create_current_weekly_session(db)
        await trigger_start_snapshot_0800(db, session.id)
        
        from backend.services.live_sync_service import start_full_sync_job
        logger.info(f"[SYNC] Creating sync session for WeeklySession ID {session.id}...")
        sync_res = start_full_sync_job(db, triggered_by="sunday_scheduler_0800")
        logger.info(f"[QUEUE] Sunday 8:00 AM sync job dispatched: status={sync_res.get('status')}, job_id={sync_res.get('job_id')}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_start_job execution: {e}")
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
    logger.info("Executing Scheduled Job: Sunday 9:45 AM Public Contest & Auto Email Dispatch...")
    db = SessionLocal()
    try:
        from backend.services.weekly_report_service import run_sunday_0945_public_contest_workflow
        res = run_sunday_0945_public_contest_workflow(db)
        logger.info(f"Sunday 9:45 AM Public Contest Workflow Completed: {res}")
    except Exception as e:
        logger.error(f"Error in sunday_0945_public_contest_workflow execution: {e}")

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


async def sunday_2200_virtual_contest_job():
    """
    Scheduled for Sunday 10:00 PM IST: End-of-Day Virtual contest fetch, combined report generation & final email.
    """
    logger.info("Executing Scheduled Job: Sunday 10:00 PM Virtual Contest Final Workflow...")
    db = SessionLocal()
    try:
        from backend.services.weekly_report_service import run_sunday_2200_virtual_contest_workflow
        res = run_sunday_2200_virtual_contest_workflow(db)
        logger.info(f"Sunday 10:00 PM Virtual Contest Workflow Completed: {res}")
    except Exception as e:
        logger.error(f"Error in sunday_2200_virtual_contest_job: {e}")
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

last_public_run_time = None
last_virtual_run_time = None

def get_scheduler_health():
    """Returns Asia/Kolkata timezone scheduler health status and next/last run timestamps."""
    next_pub, next_vir = None, None
    if scheduler.running:
        for j in scheduler.get_jobs():
            if j.id == 'sunday_auto_email_945' and j.next_run_time:
                next_pub = j.next_run_time.strftime("%Y-%m-%d %H:%M:%S IST")
            elif j.id == 'sunday_virtual_contest_2200' and j.next_run_time:
                next_vir = j.next_run_time.strftime("%Y-%m-%d %H:%M:%S IST")

    return {
        "timezone": "Asia/Kolkata",
        "scheduler_status": "RUNNING" if scheduler.running else "SCHEDULED",
        "next_public_run": next_pub or "Sunday 09:45:00 IST",
        "next_virtual_run": next_vir or "Sunday 22:00:00 IST",
        "last_public_run": last_public_run_time.strftime("%Y-%m-%d %H:%M:%S IST") if last_public_run_time else None,
        "last_virtual_run": last_virtual_run_time.strftime("%Y-%m-%d %H:%M:%S IST") if last_virtual_run_time else None
    }

def start_scheduler():
    """
    Starts the APScheduler cron jobs under Asia/Kolkata IST timezone.
    """
    if scheduler.running:
        logger.info("APScheduler is already running. Skipping redundant start.")
        return

    # Cron for Sunday 8:00 AM IST
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

    # Cron for Sunday 9:45 AM IST — Public Contest Fetch + Email Dispatch
    scheduler.add_job(
        sunday_auto_email_job,
        CronTrigger(day_of_week='sun', hour=9, minute=45, timezone=tz),
        id='sunday_auto_email_945',
        replace_existing=True
    )

    # Cron for Sunday 10:00 AM IST — Official Sunday Report Generation
    async def sunday_1000_report_job():
        logger.info("[SCHEDULER] Sunday 10:00 AM IST: Triggering Official Weekly Report generation...")
        try:
            from backend.services.sunday_lifecycle import SundayLifecycle
            lifecycle = SundayLifecycle(db_session_factory=SessionLocal, scheduler=scheduler)
            contest = await lifecycle.discover_current_weekly()
            await lifecycle.generate_sunday_report(contest)
            logger.info("[SCHEDULER] Sunday 10:00 AM Report successfully generated.")
        except Exception as e:
            logger.error(f"[SCHEDULER] Sunday 10:00 AM Report generation error: {e}")

    scheduler.add_job(
        sunday_1000_report_job,
        CronTrigger(day_of_week='sun', hour=10, minute=0, timezone=IST),
        id='sunday_report',
        replace_existing=True
    )

    # Job: Contest Discovery (Every 5 minutes)
    async def contest_discovery_job():
        try:
            from backend.services.sunday_lifecycle import SundayLifecycle
            lifecycle = SundayLifecycle(db_session_factory=SessionLocal, scheduler=scheduler)
            await lifecycle.discover_current_weekly()
        except Exception as e:
            logger.debug(f"[SCHEDULER] Contest discovery check error: {e}")

    scheduler.add_job(
        contest_discovery_job,
        IntervalTrigger(minutes=5, timezone=IST),
        id='contest_discovery',
        replace_existing=True
    )

    # Job: Hourly Verification Worker
    async def hourly_verification_job():
        try:
            from backend.services.sunday_lifecycle import SundayLifecycle
            lifecycle = SundayLifecycle(db_session_factory=SessionLocal, scheduler=scheduler)
            contest = await lifecycle.discover_current_weekly()
            await lifecycle.collect_and_classify_participants(contest)
        except Exception as e:
            logger.debug(f"[SCHEDULER] Hourly verification error: {e}")

    scheduler.add_job(
        hourly_verification_job,
        IntervalTrigger(hours=1, timezone=IST),
        id='verification_worker',
        replace_existing=True
    )

    # Job: Daily Rating Updater (2:00 AM IST)
    async def daily_rating_update_job():
        logger.info("[SCHEDULER] 02:00 AM IST: Running daily rating updater...")
        try:
            await run_batch_sync()
        except Exception as e:
            logger.error(f"[SCHEDULER] Daily rating update error: {e}")

    scheduler.add_job(
        daily_rating_update_job,
        CronTrigger(hour=2, minute=0, timezone=IST),
        id='rating_updater',
        replace_existing=True
    )

    scheduler.start()
    logger.info("APScheduler started [Asia/Kolkata]: Sunday 8:00 AM Start, 9:30 AM End, 9:45 AM Public Report, 10:00 AM Sunday Report, 10:00 PM Virtual Final Report, 5m Discovery, 1h Verification, 2am Rating Updater registered.")



