import os
import uuid
import datetime
import pytz
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from apscheduler.triggers.cron import CronTrigger

from backend.config import settings
from backend.models import (
    ScheduledReportConfig,
    ReportExecutionHistory,
    WeeklySession,
    Student,
    ReportEmailRecipient,
    AdminAuditLog
)
from backend.logger import logger
from backend.database import SessionLocal

KOLKATA_TZ = pytz.timezone("Asia/Kolkata")
DAY_OF_WEEK_MAP = {
    "sunday": "sun",
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
    "sun": "sun",
    "mon": "mon",
    "tue": "tue",
    "wed": "wed",
    "thu": "thu",
    "fri": "fri",
    "sat": "sat"
}


def get_or_create_default_schedule(db: Session) -> ScheduledReportConfig:
    """
    Returns the persisted schedule configuration. If none exists, creates default Sunday 09:45 AM IST schedule.
    """
    config = db.query(ScheduledReportConfig).filter(
        ScheduledReportConfig.report_type == "weekly_public_leetcode"
    ).first()

    if not config:
        # Default recipients
        default_recipients = [e.strip() for e in settings.REPORT_RECIPIENT_EMAILS.split(",") if e.strip()]
        if not default_recipients:
            default_recipients = ["nanthishvaran17@gmail.com", "hod_cse@nandhaengg.org", "principal@nandhaengg.org"]

        config = ScheduledReportConfig(
            report_type="weekly_public_leetcode",
            report_name="Weekly Public LeetCode Report",
            day_of_week="sunday",
            hour=9,
            minute=45,
            timezone="Asia/Kolkata",
            is_enabled=True,
            recipients=default_recipients,
            job_id="sunday_auto_email_945",
            last_status="NOT_RUN_YET",
            last_email_status="PENDING",
            updated_by="System Initializer"
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    return config


def compute_next_run_ist(day_of_week: str, hour: int, minute: int) -> str:
    """Calculates formatted next execution time strictly in Asia/Kolkata (IST)."""
    now_ist = datetime.datetime.now(KOLKATA_TZ)
    target_day_idx = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].index(day_of_week.lower())
    
    days_ahead = target_day_idx - now_ist.weekday()
    if days_ahead < 0 or (days_ahead == 0 and (now_ist.hour > hour or (now_ist.hour == hour and now_ist.minute >= minute))):
        days_ahead += 7

    target_date = now_ist.date() + datetime.timedelta(days=days_ahead)
    target_dt = KOLKATA_TZ.localize(datetime.datetime.combine(target_date, datetime.time(hour, minute, 0)))
    
    return target_dt.strftime("%A, %d %B %Y — %I:%M %p IST")


def register_apscheduler_job(config: ScheduledReportConfig) -> Optional[str]:
    """
    Registers or updates the schedule in APScheduler using Asia/Kolkata timezone and stable job ID.
    """
    try:
        from backend.scheduler import scheduler
        if not scheduler:
            return None

        dow_cron = DAY_OF_WEEK_MAP.get(config.day_of_week.lower(), "sun")
        job_id = config.job_id or "sunday_auto_email_945"

        if config.is_enabled:
            # Add or replace existing job
            scheduler.add_job(
                scheduled_report_runner_wrapper,
                CronTrigger(day_of_week=dow_cron, hour=config.hour, minute=config.minute, timezone=KOLKATA_TZ),
                id=job_id,
                replace_existing=True,
                args=[config.id]
            )
            logger.info(f"Registered APScheduler job '{job_id}' for {config.day_of_week} {config.hour:02d}:{config.minute:02d} IST (replace_existing=True)")
            
            # Fetch next run from scheduler
            job = scheduler.get_job(job_id)
            if job and getattr(job, 'next_run_time', None):
                return job.next_run_time.astimezone(KOLKATA_TZ).strftime("%A, %d %B %Y — %I:%M %p IST")
        else:
            # If disabled, remove job from APScheduler
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)
                logger.info(f"Removed APScheduler job '{job_id}' because schedule is disabled.")

    except Exception as e:
        logger.error(f"Error registering APScheduler job: {e}")

    return compute_next_run_ist(config.day_of_week, config.hour, config.minute)


async def scheduled_report_runner_wrapper(schedule_id: int):
    """Wrapper invoked by APScheduler cron engine at trigger time."""
    logger.info(f"[REPORT_JOB_STARTED] Invoking automated report runner for schedule_id={schedule_id}")
    db = SessionLocal()
    try:
        await execute_scheduled_report_pipeline(db, schedule_id=schedule_id, is_test_run=False)
    except Exception as e:
        logger.error(f"Failed in scheduled_report_runner_wrapper: {e}")
    finally:
        db.close()


def save_report_schedule(db: Session, data: Dict[str, Any], admin_email: str = "Admin") -> Dict[str, Any]:
    """
    Validates, updates, and persists administrator schedule configuration.
    """
    # 1. Validation
    day = str(data.get("day_of_week", "sunday")).lower()
    if day not in DAY_OF_WEEK_MAP:
        raise ValueError(f"Invalid day '{day}'. Allowed: Sunday to Saturday.")

    try:
        hour = int(data.get("hour", 9))
        minute = int(data.get("minute", 45))
        if not (0 <= hour <= 23) or not (0 <= minute <= 59):
            raise ValueError()
    except Exception:
        raise ValueError("Invalid time format. Hour must be 0-23, Minute must be 0-59.")

    timezone = data.get("timezone", "Asia/Kolkata")
    if timezone != "Asia/Kolkata":
        timezone = "Asia/Kolkata" # strictly enforce Asia/Kolkata

    recipients = data.get("recipients", [])
    if isinstance(recipients, str):
        recipients = [e.strip() for e in recipients.split(",") if e.strip()]
    if not recipients:
        raise ValueError("At least one valid recipient email is required.")

    is_enabled = bool(data.get("is_enabled", True))
    report_name = data.get("report_name", "Weekly Public LeetCode Report")

    # 2. Persistence
    config = get_or_create_default_schedule(db)
    config.report_name = report_name
    config.day_of_week = day
    config.hour = hour
    config.minute = minute
    config.timezone = "Asia/Kolkata"
    config.recipients = recipients
    config.is_enabled = is_enabled
    config.updated_by = admin_email
    config.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(config)

    # 3. Update APScheduler
    next_run_str = register_apscheduler_job(config)

    # 4. Audit Log
    audit = AdminAuditLog(
        audit_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        admin_email=admin_email,
        action="UPDATE_REPORT_SCHEDULE",
        action_type="SETTINGS",
        description=f"Configured schedule for '{report_name}' on {day.capitalize()} at {hour:02d}:{minute:02d} IST (Enabled: {is_enabled})",
        status="SUCCESS",
        metadata_json={
            "day": day,
            "time": f"{hour:02d}:{minute:02d}",
            "recipients_count": len(recipients),
            "enabled": is_enabled
        }
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Schedule saved successfully for {day.capitalize()} at {hour:02d}:{minute:02d} IST",
        "next_run": next_run_str,
        "config": {
            "id": config.id,
            "report_name": config.report_name,
            "day_of_week": config.day_of_week,
            "hour": config.hour,
            "minute": config.minute,
            "timezone": config.timezone,
            "is_enabled": config.is_enabled,
            "recipients": config.recipients,
            "recipients_count": len(config.recipients or [])
        }
    }


def toggle_report_schedule(db: Session, enable: bool, admin_email: str = "Admin") -> Dict[str, Any]:
    """Enables or disables the scheduled report automation."""
    config = get_or_create_default_schedule(db)
    config.is_enabled = enable
    config.updated_by = admin_email
    config.updated_at = datetime.datetime.utcnow()
    db.commit()

    next_run_str = register_apscheduler_job(config)

    action_name = "ENABLE_REPORT_SCHEDULE" if enable else "DISABLE_REPORT_SCHEDULE"
    audit = AdminAuditLog(
        audit_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        admin_email=admin_email,
        action=action_name,
        action_type="SETTINGS",
        description=f"{'Enabled' if enable else 'Disabled'} scheduled report automation.",
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "is_enabled": config.is_enabled,
        "message": f"Scheduled report automation is now {'ENABLED 🟢' if enable else 'DISABLED 🔴'}",
        "next_run": next_run_str if enable else "Automation Disabled"
    }


async def execute_scheduled_report_pipeline(
    db: Session,
    schedule_id: Optional[int] = None,
    is_test_run: bool = False,
    test_recipient: Optional[str] = None
) -> Dict[str, Any]:
    """
    Authoritative state-machine automated report execution pipeline:
    STARTED -> DATA_PROCESSING -> REPORT_GENERATED -> ATTACHMENT_READY -> EMAIL_SENDING -> COMPLETED
    """
    now_ist = datetime.datetime.now(KOLKATA_TZ)
    date_str = now_ist.strftime("%Y%m%d")
    today_iso = now_ist.strftime("%Y-%m-%d")
    exec_id = f"EXEC-{date_str}-{uuid.uuid4().hex[:6].upper()}"

    config = get_or_create_default_schedule(db) if not schedule_id else db.query(ScheduledReportConfig).filter(ScheduledReportConfig.id == schedule_id).first()
    if not config:
        config = get_or_create_default_schedule(db)

    # 1. State: STARTED
    hist = ReportExecutionHistory(
        execution_id=exec_id,
        schedule_id=config.id,
        report_type=config.report_type,
        scheduled_time=f"{config.hour:02d}:{config.minute:02d} IST",
        scheduled_date=today_iso,
        actual_start=datetime.datetime.utcnow(),
        contest_name="Weekly Contest",
        students_processed=0,
        status="STARTED",
        is_test_run=is_test_run,
        idempotency_key=f"TEST_{exec_id}" if is_test_run else f"CONTEST_PUBLIC_{today_iso}_{config.hour:02d}{config.minute:02d}"
    )
    db.add(hist)
    db.commit()
    db.refresh(hist)

    # 2. Idempotency Check (for non-test runs)
    if not is_test_run:
        idempotency_key = f"CONTEST_PUBLIC_{today_iso}_{config.hour:02d}{config.minute:02d}"
        existing_success = db.query(ReportExecutionHistory).filter(
            ReportExecutionHistory.idempotency_key == idempotency_key,
            ReportExecutionHistory.status == "COMPLETED",
            ReportExecutionHistory.id != hist.id
        ).first()

        if existing_success:
            logger.warning(f"IDEMPOTENCY_GUARD: Execution key '{idempotency_key}' already succeeded at {existing_success.actual_end}. Blocking duplicate dispatch.")
            hist.status = "EMAIL_BLOCKED"
            hist.error_message = f"Duplicate execution blocked by Idempotency Key ({idempotency_key})"
            hist.actual_end = datetime.datetime.utcnow()
            db.commit()
            return {
                "success": False,
                "status": "EMAIL_BLOCKED",
                "message": "Duplicate report execution blocked. Email already dispatched for this session window.",
                "execution_id": exec_id
            }

    try:
        # 3. State: DATA_PROCESSING
        hist.status = "DATA_PROCESSING"
        db.commit()

        # Load active students
        students = db.query(Student).filter(Student.is_active == True).all()
        student_count = len(students)
        hist.students_processed = student_count

        # Load or create weekly session
        session = db.query(WeeklySession).filter(WeeklySession.session_date == today_iso).first()
        if not session:
            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

        contest_name = session.contest_name if session else "Weekly Contest 470"
        hist.contest_name = contest_name

        # 4. State: REPORT_GENERATED & ATTACHMENT_READY (Dynamic Excel Filename)
        hist.status = "REPORT_GENERATED"
        
        # Generate Master institutional Excel from unified pipeline
        from backend.routes.reports import _get_dataset_for_id
        from backend.exporters.excel_exporter import export_excel_from_dataset
        
        report_id_str = f"Session_{session.id}" if session else "official"
        dataset, filename_base = _get_dataset_for_id(report_id_str, db, dept="ALL", year="ALL", attendance="ALL")
        excel_bytes = export_excel_from_dataset(dataset)
        excel_filename = f"{filename_base}.xlsx"

        hist.excel_generated = True
        hist.excel_filename = excel_filename
        hist.status = "ATTACHMENT_READY"
        db.commit()

        # 5. State: EMAIL_SENDING
        hist.status = "EMAIL_SENDING"
        db.commit()

        if is_test_run and test_recipient:
            recipients = [test_recipient]
        else:
            db_recs = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.is_active == True).all()
            db_emails = [r.email for r in db_recs if r.email]
            cfg_emails = config.recipients or []
            combined_emails = list(dict.fromkeys(db_emails + cfg_emails))
            recipients = combined_emails if combined_emails else ["nanthishvaran17@gmail.com", "msanthoshkumar@nandhaengg.org"]
        
        hist.recipients_count = len(recipients)

        subject = f"{'[SAFE TEST MODE] ' if is_test_run else ''}NANDHA Engineering College — Weekly LeetCode Public Performance Report | {config.hour:02d}:{config.minute:02d} AM IST"
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 680px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%); color: #ffffff; padding: 24px; text-align: center; border-radius: 16px 16px 0 0;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</h2>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #38bdf8; font-weight: bold;">LeetCode Weekly Performance Tracker — Official Public Digest</p>
                {f'<span style="display:inline-block; margin-top: 10px; background-color: #d97706; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold;">SAFE TEST MODE EXECUTION</span>' if is_test_run else ''}
            </div>

            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 28px; border-radius: 0 0 16px 16px;">
                <h3 style="color: #0f172a; margin-top: 0;">Weekly Contest Performance Report</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;"><strong>Contest Name:</strong></td>
                        <td style="padding: 8px 0; color: #0f172a; text-align: right;"><strong>{contest_name}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;"><strong>Contest Date:</strong></td>
                        <td style="padding: 8px 0; color: #0f172a; text-align: right;">{now_ist.strftime('%A, %d %B %Y')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;"><strong>Generation Time:</strong></td>
                        <td style="padding: 8px 0; color: #0f172a; text-align: right;">{now_ist.strftime('%I:%M:%S %p IST')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;"><strong>Active Students Evaluated:</strong></td>
                        <td style="padding: 8px 0; color: #16a34a; font-weight: bold; text-align: right;">{student_count} Verified Profiles</td>
                    </tr>
                </table>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #334155;">
                        📎 <strong>Attached Report:</strong> <code>{excel_filename}</code><br/>
                        Contains comprehensive department performance matrices, score distributions, and contest validation sheets.
                    </p>
                </div>

                <p style="font-size: 12px; color: #64748b; margin: 0;">
                    This is an automated institutional communication generated by the <strong>Autonomous LeetCode Tracking Daemon</strong> (Asia/Kolkata).
                </p>
            </div>
        </body>
        </html>
        """

        # Dispatch via email service
        from backend.services.email_service import send_email
        send_success = False
        email_error = None

        if recipients:
            for r in recipients:
                success, err = send_email(
                    recipient=r,
                    subject=subject,
                    html_body=body_html,
                    attachments=[(excel_filename, excel_bytes)]
                )
                if success:
                    send_success = True
                else:
                    email_error = err
        else:
            # Sandbox / local simulation if SMTP is not fully configured
            send_success = True
            logger.info(f"Sandbox Email simulated with attachment {excel_filename}")

        if send_success:
            # 6. State: COMPLETED
            hist.status = "COMPLETED"
            hist.email_sent = True
            hist.actual_end = datetime.datetime.utcnow()
            
            config.last_run = datetime.datetime.utcnow()
            config.last_status = "SUCCESS"
            config.last_report_filename = excel_filename
            config.last_email_status = "DISPATCHED"
            db.commit()

            return {
                "success": True,
                "status": "COMPLETED",
                "message": f"Successfully generated '{excel_filename}' and dispatched report to {len(recipients)} recipients.",
                "execution_id": exec_id,
                "excel_filename": excel_filename,
                "recipients_count": len(recipients),
                "is_test_run": is_test_run
            }
        else:
            hist.status = "FAILED"
            hist.error_message = email_error or "Email dispatch failed."
            hist.actual_end = datetime.datetime.utcnow()
            config.last_status = "FAILED"
            config.last_email_status = "FAILED"
            db.commit()
            return {
                "success": False,
                "status": "FAILED",
                "message": email_error or "Email dispatch failed.",
                "execution_id": exec_id
            }

    except Exception as exc:
        logger.error(f"Pipeline failure in execute_scheduled_report_pipeline: {exc}")
        hist.status = "FAILED"
        hist.error_message = str(exc)
        hist.actual_end = datetime.datetime.utcnow()
        config.last_status = "FAILED"
        config.last_email_status = "FAILED"
        db.commit()
        return {
            "success": False,
            "status": "FAILED",
            "message": f"Report execution failed: {str(exc)}",
            "execution_id": exec_id
        }


def get_schedule_status(db: Session) -> Dict[str, Any]:
    """Returns comprehensive scheduled report status for Admin System Control Center."""
    config = get_or_create_default_schedule(db)
    
    # Scheduler Running State
    scheduler_running = False
    scheduler_next_run = None
    try:
        from backend.scheduler import scheduler
        if scheduler and scheduler.running:
            scheduler_running = True
            job = scheduler.get_job(config.job_id or "sunday_auto_email_945")
            if job and job.next_run_time:
                scheduler_next_run = job.next_run_time.astimezone(KOLKATA_TZ).strftime("%A, %d %B %Y — %I:%M %p IST")
    except Exception:
        pass

    # Email Service Health
    email_ready = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD and "@" in settings.SMTP_USERNAME)
    
    next_run_display = scheduler_next_run or compute_next_run_ist(config.day_of_week, config.hour, config.minute)
    
    return {
        "schedule": {
            "id": config.id,
            "report_name": config.report_name,
            "day_of_week": config.day_of_week.capitalize(),
            "hour": config.hour,
            "minute": config.minute,
            "time_display": f"{config.hour:02d}:{config.minute:02d} {'AM' if config.hour < 12 else 'PM'}",
            "timezone": "Asia/Kolkata",
            "is_enabled": config.is_enabled,
            "recipients": config.recipients or [],
            "recipients_count": len(config.recipients or []),
            "next_run": next_run_display if config.is_enabled else "Automation Disabled",
            "last_run": config.last_run.astimezone(KOLKATA_TZ).strftime("%d %b %Y — %I:%M %p IST") if config.last_run else "Pending First Execution",
            "last_status": config.last_status,
            "last_report": config.last_report_filename or "Pending Generation",
            "last_email": config.last_email_status
        },
        "scheduler_status": "RUNNING" if scheduler_running else "SCHEDULED",
        "email_service": "READY" if email_ready else "UNAVAILABLE",
        "timezone": "Asia/Kolkata (IST)"
    }


def get_execution_history(db: Session, limit: int = 15) -> List[Dict[str, Any]]:
    """Returns chronologically ordered report execution history records."""
    records = db.query(ReportExecutionHistory).order_by(ReportExecutionHistory.id.desc()).limit(limit).all()
    
    return [{
        "id": r.id,
        "execution_id": r.execution_id,
        "date": r.scheduled_date or (r.created_at.strftime("%Y-%m-%d") if r.created_at else "Today"),
        "scheduled_time": r.scheduled_time,
        "actual_start": r.actual_start.astimezone(KOLKATA_TZ).strftime("%H:%M:%S") if r.actual_start else "-",
        "actual_end": r.actual_end.astimezone(KOLKATA_TZ).strftime("%H:%M:%S") if r.actual_end else "-",
        "contest": r.contest_name,
        "students_processed": r.students_processed,
        "excel_generated": r.excel_generated,
        "excel_filename": r.excel_filename,
        "email_sent": r.email_sent,
        "recipients_count": r.recipients_count,
        "status": r.status,
        "is_test_run": r.is_test_run,
        "error_message": r.error_message
    } for r in records]
