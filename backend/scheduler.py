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

async def sunday_0755_init_job():
    """
    Scheduled for Sunday 07:55 AM IST: Pre-contest session initialization,
    dynamic contest discovery, active roster freezing, and pre-contest baseline recording.
    """
    logger.info("[SCHEDULER] Sunday 07:55 AM IST: Initializing upcoming WeeklySession and freezing active roster...")
    db = SessionLocal()
    try:
        session = get_or_create_current_weekly_session(db)
        logger.info(f"[SCHEDULER] Active session verified: {session.contest_name} ({session.session_date}), Status: {session.status}, Active Students: {session.total_students}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_0755_init_job: {e}")
    finally:
        db.close()

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

    # Cron for Sunday 7:55 AM IST — Session Initialization & Roster Freeze
    scheduler.add_job(
        sunday_0755_init_job,
        CronTrigger(day_of_week='sun', hour=7, minute=55, timezone=tz),
        id='sunday_0755_init',
        replace_existing=True
    )

    # Cron for Sunday 8:00 AM IST — Contest Window Open & Live Delta Ingestion
    scheduler.add_job(
        sunday_start_job,
        CronTrigger(day_of_week='sun', hour=8, minute=0, timezone=tz),
        id='sunday_start_snapshot',
        replace_existing=True
    )

    # Cron for Sunday 9:30 AM IST — Ingestion Stop & Snapshot SHA-256 Lock
    scheduler.add_job(
        sunday_end_job,
        CronTrigger(day_of_week='sun', hour=9, minute=30, timezone=tz),
        id='sunday_end_snapshot',
        replace_existing=True
    )

    # Cron for Sunday 9:45 AM IST — Public Contest Verification, 4-Sheet Excel, PDF, & Email Queue
    scheduler.add_job(
        sunday_auto_email_job,
        CronTrigger(day_of_week='sun', hour=9, minute=45, timezone=tz),
        id='sunday_auto_email_945',
        replace_existing=True
    )

    # Cron for Sunday 10:00 PM (22:00) IST — Virtual Practice Reconciliation & EOD Wrap-Up
    scheduler.add_job(
        sunday_2200_virtual_contest_job,
        CronTrigger(day_of_week='sun', hour=22, minute=0, timezone=tz),
        id='sunday_virtual_contest_2200',
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

    # ── DUAL-SYNC TRACKER JOB 1: Sunday 10:00 AM IST — Official Contest Batch Scrape ──
    async def tracker_dual_sync_morning():
        """Sunday 10:00 AM IST: Post-official contest mass scrape & GREEN/YELLOW/RED classification."""
        logger.info("[TRACKER] Dual-Sync Job 1: Sunday 10:00 AM IST — Official Contest Batch Scrape starting...")
        try:
            db = SessionLocal()
            from backend.leetcode_tracker import execute_dual_sync_job
            # Call the tracker's batch sync logic directly
            from fastapi import Query
            result = await execute_dual_sync_job.__wrapped__(job_type="morning", db=db) if hasattr(execute_dual_sync_job, "__wrapped__") else None
            if result is None:
                # Import the core function directly
                from backend.leetcode_tracker import (
                    fetch_leetcode_contest_and_submissions,
                    classify_student_contest_performance,
                    get_now_ist, format_ist
                )
                from backend.models import Student, WeeklySession, WeeklyPublicResult
                students = db.query(Student).filter(
                    (Student.is_active == True) | (Student.is_active.is_(None))
                ).all()
                active_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
                official_cnt, virtual_cnt, absent_cnt = 0, 0, 0
                for s in students:
                    if not s.username:
                        absent_cnt += 1
                        continue
                    try:
                        gql = await fetch_leetcode_contest_and_submissions(s.username)
                        res = classify_student_contest_performance(gql, active_session.contest_name if active_session else "Weekly Contest 515")
                        if active_session:
                            rec = db.query(WeeklyPublicResult).filter(
                                WeeklyPublicResult.session_id == active_session.id,
                                WeeklyPublicResult.student_id == s.id
                            ).first()
                            if not rec:
                                rec = WeeklyPublicResult(
                                    session_id=active_session.id,
                                    student_id=s.id,
                                    reg_no=s.reg_no,
                                    name=s.name,
                                    dept=s.department.name if s.department else "CSE-CS",
                                    year=s.year_level or "III Year"
                                )
                                db.add(rec)
                            rec.participation_status = res["attendance_status"]
                            rec.total_contest_solved = res["solved_count"]
                            rec.q1, rec.q2, rec.q3, rec.q4 = res["q1"], res["q2"], res["q3"], res["q4"]
                        if res["badge_type"] == "GREEN": official_cnt += 1
                        elif res["badge_type"] == "YELLOW": virtual_cnt += 1
                        else: absent_cnt += 1
                    except Exception as se:
                        logger.warning(f"[TRACKER] Student {s.reg_no} sync error: {se}")
                        absent_cnt += 1
                if active_session:
                    active_session.official_participants = official_cnt
                    active_session.virtual_participants = virtual_cnt
                    active_session.not_participated = absent_cnt
                db.commit()
                logger.info(f"[TRACKER] Dual-Sync Morning complete: Official={official_cnt}, Virtual={virtual_cnt}, Absent={absent_cnt}")
        except Exception as e:
            logger.error(f"[TRACKER] Dual-Sync Morning Job error: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

    scheduler.add_job(
        tracker_dual_sync_morning,
        CronTrigger(day_of_week='sun', hour=10, minute=0, second=0, timezone=IST),
        id='tracker_dual_sync_morning',
        replace_existing=True
    )

    # ── DUAL-SYNC TRACKER JOB 2: Sunday 10:00 PM IST — Virtual Contest Consolidation ──
    async def tracker_dual_sync_evening():
        """Sunday 10:00 PM IST: End-of-day virtual contest delta scan & immutable snapshot finalization."""
        logger.info("[TRACKER] Dual-Sync Job 2: Sunday 10:00 PM IST — Virtual Consolidation starting...")
        try:
            db = SessionLocal()
            from backend.leetcode_tracker import (
                fetch_leetcode_contest_and_submissions,
                classify_student_contest_performance,
            )
            from backend.models import Student, WeeklySession, WeeklyPublicResult
            students = db.query(Student).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).all()
            active_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            virtual_updated = 0
            for s in students:
                if not s.username:
                    continue
                try:
                    gql = await fetch_leetcode_contest_and_submissions(s.username)
                    res = classify_student_contest_performance(gql, active_session.contest_name if active_session else "Weekly Contest 515")
                    # Only update records that switched to VIRTUAL during post-9:30 window
                    if active_session and res["badge_type"] == "YELLOW":
                        rec = db.query(WeeklyPublicResult).filter(
                            WeeklyPublicResult.session_id == active_session.id,
                            WeeklyPublicResult.student_id == s.id
                        ).first()
                        if rec and rec.participation_status != "OFFICIAL_ATTENDED":
                            rec.participation_status = "VIRTUAL_ATTENDED"
                            rec.total_contest_solved = res["solved_count"]
                            rec.q1, rec.q2, rec.q3, rec.q4 = res["q1"], res["q2"], res["q3"], res["q4"]
                            virtual_updated += 1
                except Exception as se:
                    logger.warning(f"[TRACKER] Evening delta student {s.reg_no} error: {se}")
            if active_session:
                active_session.status = "FINALIZED"
                active_session.virtual_participants = (active_session.virtual_participants or 0) + virtual_updated
            db.commit()
            logger.info(f"[TRACKER] Dual-Sync Evening complete: Virtual delta updates={virtual_updated}")
        except Exception as e:
            logger.error(f"[TRACKER] Dual-Sync Evening Job error: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

    scheduler.add_job(
        tracker_dual_sync_evening,
        CronTrigger(day_of_week='sun', hour=22, minute=0, second=0, timezone=IST),
        id='tracker_dual_sync_evening',
        replace_existing=True
    )

    scheduler.start()
    logger.info(
        "APScheduler started [Asia/Kolkata]: "
        "Sun 8:00 AM Start, 9:30 AM End, 9:45 AM Public Report, "
        "10:00 AM Sunday Report + TRACKER Dual-Sync Morning, "
        "10:00 PM Virtual Final + TRACKER Dual-Sync Evening, "
        "5m Discovery, 1h Verification, 2am Rating Updater registered."
    )



