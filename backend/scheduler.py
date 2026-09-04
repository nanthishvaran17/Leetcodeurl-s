import asyncio
import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED
from backend.database import engine
from backend.models import ScheduledJobExecution

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.time_utils import IST

from backend.database import SessionLocal
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

from backend.services.live_sync_service import start_full_sync_job
from backend.logger import logger


from backend.services.sunday_autopilot import sunday_autopilot

tz = IST

from backend.services.live_sync_service import _acquire_global_lock, _release_global_lock
import functools

def with_global_lock(job_name: str, timeout_minutes: int = 15):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            db = SessionLocal()
            try:
                if not _acquire_global_lock(db, job_name, timeout_minutes=timeout_minutes):
                    logger.warning(f'[SCHEDULER] Job {job_name} skipped. GlobalSyncLock acquired by another worker.')
                    return
                logger.info(f'[SCHEDULER] Acquired GlobalSyncLock for {job_name}')
            finally:
                db.close()
            
            try:
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
            finally:
                db2 = SessionLocal()
                try:
                    _release_global_lock(db2, job_name)
                    logger.info(f'[SCHEDULER] Released GlobalSyncLock for {job_name}')
                finally:
                    db2.close()
        return wrapper
    return decorator

jobstores = {
    'default': SQLAlchemyJobStore(engine=engine, tablename='apscheduler_jobs')
}
scheduler = AsyncIOScheduler(jobstores=jobstores, timezone=IST)

def apscheduler_listener(event):
    db = SessionLocal()
    try:
        if event.code == EVENT_JOB_EXECUTED:
            status = 'COMPLETED'
        elif event.code == EVENT_JOB_ERROR:
            status = 'ERROR'
        elif event.code == EVENT_JOB_MISSED:
            status = 'MISSED'
        else:
            status = 'UNKNOWN'
        
        job = scheduler.get_job(event.job_id)
        next_run = job.next_run_time if job else None

        record = ScheduledJobExecution(
            job_id=event.job_id,
            job_type=str(type(event)),
            scheduled_at=event.scheduled_run_time if hasattr(event, 'scheduled_run_time') else None,
            completed_at=datetime.datetime.utcnow(),
            status=status,
            error_message=str(event.exception) if hasattr(event, 'exception') and event.exception else None,
            last_error=str(event.exception) if hasattr(event, 'exception') and event.exception else None,
            next_run=next_run
        )
        db.add(record)
        db.commit()
    except Exception as e:
        logger.error(f'[SCHEDULER LISTENER ERROR] {e}')
    finally:
        db.close()

scheduler.add_listener(apscheduler_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED)


@with_global_lock('sunday_0755_init_job', timeout_minutes=15)
async def sunday_0755_init_job():
    """
    Scheduled for Sunday 07:55 AM IST: Pre-contest session initialization,
    dynamic contest discovery, active roster freezing, and pre-contest baseline recording.
    """
    logger.info("[SCHEDULER] Sunday 07:55 AM IST: Autopilot Phase 1 Pre-Flight Initiated...")
    db = SessionLocal()
    try:
        res = sunday_autopilot.phase_1_preflight_0755(db)
        logger.info(f"[SCHEDULER] Sunday 07:55 AM Pre-Flight Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_0755_init_job: {e}", exc_info=True)
    finally:
        db.close()

@with_global_lock('sunday_start_job', timeout_minutes=15)
async def sunday_start_job():
    """
    Scheduled for Sunday 8:00 AM IST: Baseline snapshot and live student synchronization.
    """
    logger.info("[SCHEDULER] Sunday 08:00 AM IST: Autopilot Phase 2 Baseline Snapshot & LIVE Mode Start...")
    db = SessionLocal()
    try:
        res = await sunday_autopilot.phase_2_baseline_0800(db)
        logger.info(f"[SCHEDULER] Sunday 08:00 AM Baseline Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_start_job: {e}", exc_info=True)
    finally:
        db.close()

@with_global_lock('sunday_live_monitoring_job', timeout_minutes=2)
async def sunday_live_monitoring_job():
    """
    Scheduled every 1 minute during Sunday 08:00–09:30 AM IST: Live student solves tracking.
    """
    now_ist = datetime.datetime.now(tz=IST)
    if now_ist.weekday() == 6 and (datetime.time(8, 0, 0) <= now_ist.time() <= datetime.time(9, 30, 0)):
        db = SessionLocal()
        try:
            await sunday_autopilot.phase_3_live_monitoring_cycle(db)
        except Exception as e:
            logger.debug(f"[SCHEDULER] Live polling tick note: {e}")
        finally:
            db.close()

@with_global_lock('sunday_end_job', timeout_minutes=15)
async def sunday_end_job():
    """
    Scheduled for Sunday 9:30 AM IST: Final snapshot, 5-state reconciliation, and immutability lock.
    """
    logger.info("[SCHEDULER] Sunday 09:30 AM IST: Autopilot Phase 4 Final Snapshot & Data Lock...")
    db = SessionLocal()
    try:
        res = await sunday_autopilot.phase_4_finalization_0930(db)
        logger.info(f"[SCHEDULER] Sunday 09:30 AM Finalization Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_end_job: {e}", exc_info=True)
    finally:
        db.close()

@with_global_lock('sunday_0935_report_job', timeout_minutes=15)
async def sunday_0935_report_job():
    """
    Scheduled for Sunday 9:35 AM IST: Multi-Format Report Generation (Master Excel, PDF, Word, Depts).
    """
    logger.info("[SCHEDULER] Sunday 09:35 AM IST: Autopilot Phase 5 Report Generation...")
    db = SessionLocal()
    try:
        res = sunday_autopilot.phase_5_report_generation_0935(db)
        logger.info(f"[SCHEDULER] Sunday 09:35 AM Report Generation Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_0935_report_job: {e}", exc_info=True)
    finally:
        db.close()

@with_global_lock('sunday_0940_email_job', timeout_minutes=15)
async def sunday_0940_email_job():
    """
    Scheduled for Sunday 9:40 AM IST: Idempotent Email Dispatch to HODs & Management.
    """
    logger.info("[SCHEDULER] Sunday 09:40 AM IST: Autopilot Phase 6 Email Dispatch...")
    db = SessionLocal()
    try:
        res = sunday_autopilot.phase_6_email_dispatch_0940(db)
        logger.info(f"[SCHEDULER] Sunday 09:40 AM Email Dispatch Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_0940_email_job: {e}", exc_info=True)
    finally:
        db.close()

@with_global_lock('sunday_2200_virtual_contest_job', timeout_minutes=120)
async def sunday_2200_virtual_contest_job():
    """
    Scheduled for Sunday 10:00 PM IST: End-of-Day Virtual contest fetch, combined report generation & final email.
    """
    logger.info("[SCHEDULER] Sunday 10:00 PM IST: Autopilot Phase 7 Virtual Contest Sync & Reconciliation...")
    db = SessionLocal()
    try:
        res = sunday_autopilot.phase_7_virtual_sync_2200(db)
        logger.info(f"[SCHEDULER] Sunday 10:00 PM Virtual Contest Completed: {res}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in sunday_2200_virtual_contest_job: {e}", exc_info=True)
    finally:
        db.close()


async def daily_auto_refresh_job():
    """
    Scheduled daily: Auto-syncs live LeetCode stats for all active students.
    """
    logger.info("Executing Scheduled Job: Daily Live Stats Sync with LeetCode...")
    db = SessionLocal()
    try:
        start_full_sync_job(db, triggered_by="scheduler_daily_refresh")
        logger.info("Daily Live Stats Sync triggered successfully.")
    except Exception as e:
        logger.error(f"Error in daily_auto_refresh_job: {e}")
    finally:
        db.close()

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

async def contest_discovery_job():
    try:
        from backend.services.sunday_lifecycle import SundayLifecycle
        lifecycle = SundayLifecycle(db_session_factory=SessionLocal, scheduler=scheduler)
        await lifecycle.discover_current_weekly()
    except Exception as e:
        logger.debug(f"[SCHEDULER] Contest discovery check error: {e}")

async def hourly_verification_job():
    try:
        from backend.services.sunday_lifecycle import SundayLifecycle
        lifecycle = SundayLifecycle(db_session_factory=SessionLocal, scheduler=scheduler)
        contest = await lifecycle.discover_current_weekly()
        await lifecycle.collect_and_classify_participants(contest)
    except Exception as e:
        logger.debug(f"[SCHEDULER] Hourly verification error: {e}")

async def daily_rating_update_job():
    logger.info("[SCHEDULER] 02:00 AM IST: Running daily rating updater...")
    db = SessionLocal()
    try:
        start_full_sync_job(db, triggered_by="scheduler_rating_updater")
    except Exception as e:
        logger.error(f"[SCHEDULER] Daily rating update error: {e}")
    finally:
        db.close()

async def tracker_dual_sync_morning():
    """Sunday 10:00 AM IST: Post-official contest mass scrape & GREEN/YELLOW/RED classification."""
    logger.info("[TRACKER] Dual-Sync Job 1: Sunday 10:00 AM IST — Official Contest Batch Scrape starting...")
    try:
        db = SessionLocal()
        from backend.leetcode_tracker import execute_dual_sync_job
        # Call the tracker's batch sync logic directly
        result = await execute_dual_sync_job.__wrapped__(job_type="morning", db=db) if hasattr(execute_dual_sync_job, "__wrapped__") else None
        if result is None:
            # Import the core function directly
            from backend.leetcode_tracker import (
                fetch_leetcode_contest_and_submissions,
                classify_student_contest_performance
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


def start_scheduler():
    """
    Starts the APScheduler cron jobs under Asia/Kolkata IST timezone.
    """
    if scheduler.running:
        logger.info("APScheduler is already running. Skipping redundant start.")
        return

    # 1. Sunday 07:55 AM IST — Pre-Flight, Discovery & Roster Freeze
    scheduler.add_job(
        sunday_0755_init_job,
        CronTrigger(day_of_week='sun', hour=7, minute=55, timezone=tz),
        id='sunday_0755_init',
        replace_existing=True,
        max_instances=1, coalesce=True, misfire_grace_time=3600
    )

    # 2. Sunday 08:00 AM IST — Baseline Snapshot & LIVE Mode Start
    scheduler.add_job(
        sunday_start_job,
        CronTrigger(day_of_week='sun', hour=8, minute=0, timezone=tz),
        id='sunday_start_snapshot',
        replace_existing=True,
        max_instances=1, coalesce=True, misfire_grace_time=3600
    )

    # 3. Sunday 08:00–09:30 AM IST (Every 1 min) — Live Solves & Telemetry Monitoring
    scheduler.add_job(
        sunday_live_monitoring_job,
        IntervalTrigger(minutes=1, timezone=tz),
        id='sunday_live_telemetry_loop',
        replace_existing=True,
        max_instances=1, coalesce=True, misfire_grace_time=120
    )

    # 4. Sunday 09:30 AM IST — Final Snapshot, 5-State Reconciliation & Data Lock
    scheduler.add_job(
        sunday_end_job,
        CronTrigger(day_of_week='sun', hour=9, minute=30, timezone=tz),
        id='sunday_end_snapshot',
        replace_existing=True,
        max_instances=1, coalesce=True, misfire_grace_time=3600
    )

    # 5. Sunday 09:35 AM IST — Multi-Format Report Generation (Excel, PDF, Word, Depts)
    scheduler.add_job(
        sunday_0935_report_job,
        CronTrigger(day_of_week='sun', hour=9, minute=35, timezone=tz),
        id='sunday_0935_report',
        replace_existing=True
    )

    # 6. Sunday 09:40 AM IST — Automated Idempotent Email Dispatch
    scheduler.add_job(
        sunday_0940_email_job,
        CronTrigger(day_of_week='sun', hour=9, minute=40, timezone=tz),
        id='sunday_0940_email',
        replace_existing=True
    )

    # 7. Sunday 10:00 PM (22:00) IST — Virtual Contest Reconciliation & EOD Summary
    scheduler.add_job(
        sunday_2200_virtual_contest_job,
        CronTrigger(day_of_week='sun', hour=22, minute=0, timezone=tz),
        id='sunday_virtual_contest_2200',
        replace_existing=True
    )

    # Startup recovery check in background
    try:
        asyncio.create_task(sunday_autopilot.resume_or_recover_on_startup())
    except Exception as _rec_err:
        logger.warning(f"[SCHEDULER] Startup recovery scheduling note: {_rec_err}")

    # Cron for Sunday 10:00 AM IST — Official Sunday Report Generation
    scheduler.add_job(
        sunday_1000_report_job,
        CronTrigger(day_of_week='sun', hour=10, minute=0, timezone=IST),
        id='sunday_report',
        replace_existing=True
    )

    # Job: Contest Discovery (Every 5 minutes)
    scheduler.add_job(
        contest_discovery_job,
        IntervalTrigger(minutes=5, timezone=IST),
        id='contest_discovery',
        replace_existing=True
    )

    # Job: Hourly Verification Worker
    scheduler.add_job(
        hourly_verification_job,
        IntervalTrigger(hours=1, timezone=IST),
        id='verification_worker',
        replace_existing=True
    )

    # Job: Daily Rating Updater (2:00 AM IST)
    scheduler.add_job(
        daily_rating_update_job,
        CronTrigger(hour=2, minute=0, timezone=IST),
        id='rating_updater',
        replace_existing=True
    )

    # ── DUAL-SYNC TRACKER JOB 1: Sunday 10:00 AM IST — Official Contest Batch Scrape ──
    scheduler.add_job(
        tracker_dual_sync_morning,
        CronTrigger(day_of_week='sun', hour=10, minute=0, second=0, timezone=IST),
        id='tracker_dual_sync_morning',
        replace_existing=True
    )

    # ── DUAL-SYNC TRACKER JOB 2: Sunday 10:00 PM IST — Virtual Contest Consolidation ──
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



