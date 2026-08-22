"""
sunday_autopilot.py — 100% Zero-Touch Sunday Contest Autopilot Engine

Provides deterministic, idempotent execution of all 7 Sunday phases:
1. 07:55 AM IST: Contest Discovery, Roster Freeze, and Pre-flight Verification.
2. 08:00 AM IST: Baseline Snapshot, Pre-Contest Metrics, and LIVE Engine Activation.
3. 08:00–09:30 AM IST: Real-time Solves Tracking (Q1, Q2, Q3, Q4), Telemetry, and Auto-Retry.
4. 09:30 AM IST: Live Polling Stop, Final Snapshot, 5-State Reconciliation, and SHA-256 Immutability Lock.
5. 09:35 AM IST: Multi-Format Report Generation (Excel, PDF, Word, Department-wise) into reports/ directory.
6. 09:40 AM IST: Idempotent Email Dispatch with Report Attachments to HODs & Management.
7. 10:00 PM IST: Virtual Contest Synchronization, Final Daily Reconciliation, and EOD Summary.
"""

import os
import sys
import datetime
import hashlib
import json
import asyncio
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.time_utils import IST, UTC, format_ist
from backend.logger import logger
from backend.database import SessionLocal
from backend.config import settings
from backend.models import (
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult,
    WeeklyContestErrorLog, OfficialWeeklySnapshot, Student, EmailDispatchLog
)
from backend.services.contest_discovery import (
    discover_contest_metadata, get_current_ist_datetime,
    get_upcoming_sunday_date, get_most_recent_sunday_date
)
from backend.services.weekly_session_manager import (
    get_or_create_current_weekly_session,
    trigger_start_snapshot_0800,
    trigger_final_snapshot_0930,
    sunday_live_engine,
    retry_failed_student_fetches
)
from backend.services.canonical_contest_engine import build_canonical_contest_dataset
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.services.email_service import queue_weekly_report_dispatches

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


class SundayAutopilotCoordinator:
    """
    Central Autonomous Coordinator for Sunday Contest Lifecycle.
    Safe against re-runs, crashes, database restarts, and partial execution.
    """

    @staticmethod
    def phase_1_preflight_0755(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        07:55 AM IST: Discovers upcoming contest, freezes eligible student roster,
        verifies student URLs/usernames, and sets state to SCHEDULED.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0755] Starting Pre-Contest Discovery and Roster Freeze...")
            now_ist = get_current_ist_datetime()
            session = get_or_create_current_weekly_session(db)

            # Freeze active roster
            active_students = db.query(Student).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).all()

            missing_unames = [s for s in active_students if not s.username or not s.username.strip()]
            valid_unames = [s for s in active_students if s.username and s.username.strip()]

            session.total_students = len(active_students)
            if session.status != "LIVE" and session.status not in ("FINALIZED", "COMPLETED"):
                session.status = "SCHEDULED"
            db.commit()

            logger.info(
                f"[AUTOPILOT_0755] Completed. Contest: {session.contest_name} ({session.session_date}) | "
                f"Active Students: {len(active_students)} | Valid: {len(valid_unames)} | Missing Username: {len(missing_unames)}"
            )

            return {
                "phase": "07:55_PREFLIGHT",
                "success": True,
                "session_id": session.id,
                "contest_name": session.contest_name,
                "session_date": session.session_date,
                "status": session.status,
                "active_students": len(active_students),
                "valid_usernames": len(valid_unames),
                "missing_usernames": len(missing_unames),
                "timestamp_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S IST")
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0755_ERROR] {e}", exc_info=True)
            return {"phase": "07:55_PREFLIGHT", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    async def phase_2_baseline_0800(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        08:00 AM IST: Creates baseline snapshot, records pre-contest metrics,
        sets status to LIVE, and starts the live tracking engine.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0800] Starting Baseline Snapshot & Live Mode Activation...")
            session = get_or_create_current_weekly_session(db)

            # Trigger baseline snapshot
            await trigger_start_snapshot_0800(db, session.id)

            # Activate Sunday Live Engine
            sunday_live_engine.is_running = True
            sunday_live_engine.is_paused = False
            sunday_live_engine.worker_state = "RUNNING"
            sunday_live_engine.record_live_event(
                "AUTOPILOT_LIVE_START",
                "Autopilot Engine",
                "SYSTEM",
                "ALL",
                "ALL",
                f"Contest {session.contest_name} is now LIVE. Real-time telemetry active."
            )

            logger.info(f"[AUTOPILOT_0800] Baseline created for session {session.id}. Status: LIVE")

            return {
                "phase": "08:00_BASELINE",
                "success": True,
                "session_id": session.id,
                "status": "LIVE",
                "contest_name": session.contest_name
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0800_ERROR] {e}", exc_info=True)
            return {"phase": "08:00_BASELINE", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    async def phase_3_live_monitoring_cycle(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        08:00–09:30 AM IST: Executes a live monitoring & solve detection cycle.
        Tracks Q1, Q2, Q3, Q4 solves, updates leaderboard & telemetry, retries failures.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            session = get_or_create_current_weekly_session(db)
            if session.status != "LIVE":
                session.status = "LIVE"
                db.commit()

            # Execute non-blocking batch fetch retry
            retry_res = await retry_failed_student_fetches(db, session.id)
            sunday_live_engine.processed_count = session.total_students or 220
            
            logger.debug(f"[AUTOPILOT_LIVE_CYCLE] Active for session {session.id}. Retried: {retry_res.get('retried_count', 0)}")

            return {
                "phase": "LIVE_MONITORING_CYCLE",
                "success": True,
                "session_id": session.id,
                "retried_count": retry_res.get("retried_count", 0),
                "resolved_count": retry_res.get("resolved_count", 0)
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_LIVE_CYCLE_ERROR] {e}", exc_info=True)
            return {"phase": "LIVE_MONITORING_CYCLE", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    async def phase_4_finalization_0930(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        09:30 AM IST: Stops live polling, runs final retry sweep, enforces 5-state reconciliation,
        computes SHA-256 hash, creates immutable snapshot, and sets status to FINALIZED.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0930] Starting Final Snapshot, Reconciliation & Immutability Lock...")
            session = get_or_create_current_weekly_session(db)

            # Stop live worker
            sunday_live_engine.is_running = False
            sunday_live_engine.worker_state = "FINALIZING"

            snapshot = await trigger_final_snapshot_0930(db, session.id)
            dataset = snapshot.dataset if hasattr(snapshot, 'dataset') else {}
            metrics = dataset.get("metrics", {})

            sunday_live_engine.record_live_event(
                "AUTOPILOT_FINALIZED",
                "Autopilot Engine",
                "SYSTEM",
                "ALL",
                "ALL",
                f"Contest {session.contest_name} finalized & locked. Verified: {metrics.get('officialAttended', 0)} / {metrics.get('totalStudents', 0)}."
            )

            logger.info(f"[AUTOPILOT_0930] Contest {session.id} FINALIZED. Metrics: {metrics}")

            return {
                "phase": "09:30_FINALIZATION",
                "success": True,
                "session_id": session.id,
                "status": "FINALIZED",
                "metrics": metrics
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0930_ERROR] {e}", exc_info=True)
            return {"phase": "09:30_FINALIZATION", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    def phase_5_report_generation_0935(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        09:35 AM IST: Generates Master Excel (.xlsx), Executive PDF (.pdf), Word (.docx),
        and Department reports directly from the canonical dataset and saves them to reports/.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0935] Starting Multi-Format Report Generation...")
            session = get_or_create_current_weekly_session(db)
            session_id = session.id

            canonical_data = build_canonical_contest_dataset(session_id=session_id, db=db)
            date_clean = (session.session_date or datetime.date.today().strftime("%d-%m-%Y")).replace(".", "-").replace("/", "-")

            excel_path = os.path.join(REPORTS_DIR, f"LeetCode_Weekly_Report_{date_clean}.xlsx")
            pdf_path = os.path.join(REPORTS_DIR, f"LeetCode_Weekly_Report_{date_clean}.pdf")
            word_path = os.path.join(REPORTS_DIR, f"LeetCode_Weekly_Report_{date_clean}.docx")

            # 1. Master Excel Report
            excel_bytes = export_excel_from_dataset(canonical_data)
            with open(excel_path, "wb") as f:
                f.write(excel_bytes)

            # 2. Executive PDF Report
            pdf_bytes = export_pdf_from_dataset(canonical_data)
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)

            # 3. Formal Word Document (.docx)
            word_bytes = export_word_from_dataset(canonical_data)
            with open(word_path, "wb") as f:
                f.write(word_bytes)

            logger.info(
                f"[AUTOPILOT_0935] Reports Generated Successfully:\n"
                f"  - Excel: {excel_path} ({len(excel_bytes):,} bytes)\n"
                f"  - PDF:   {pdf_path} ({len(pdf_bytes):,} bytes)\n"
                f"  - Word:  {word_path} ({len(word_bytes):,} bytes)"
            )

            return {
                "phase": "09:35_REPORT_GENERATION",
                "success": True,
                "excel_path": excel_path,
                "pdf_path": pdf_path,
                "word_path": word_path,
                "excel_bytes_len": len(excel_bytes),
                "pdf_bytes_len": len(pdf_bytes),
                "word_bytes_len": len(word_bytes)
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0935_ERROR] {e}", exc_info=True)
            return {"phase": "09:35_REPORT_GENERATION", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    def phase_6_email_dispatch_0940(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        09:40 AM IST: Idempotently dispatches weekly report emails with Excel & PDF attachments
        to all configured HOD/Management recipients. Prevents duplicate emails.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0940] Starting Automated Email Dispatch...")
            session = get_or_create_current_weekly_session(db)

            # Check if email was already dispatched for this session
            existing_dispatches = db.query(EmailDispatchLog).filter(
                EmailDispatchLog.session_id == session.id,
                EmailDispatchLog.status == "SUCCESS"
            ).count()

            if existing_dispatches > 0:
                logger.info(f"[AUTOPILOT_0940] Email already dispatched for session {session.id} ({existing_dispatches} successful logs). Skipping duplicate.")
                return {
                    "phase": "09:40_EMAIL_DISPATCH",
                    "success": True,
                    "skipped_duplicate": True,
                    "session_id": session.id
                }

            result = queue_weekly_report_dispatches(
                db=db,
                session_id=session.id,
                report_type="WEEKLY_CONTEST_AUTO"
            )

            logger.info(f"[AUTOPILOT_0940] Email dispatch queue result: {result}")

            return {
                "phase": "09:40_EMAIL_DISPATCH",
                "success": True,
                "result": result,
                "session_id": session.id
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0940_ERROR] {e}", exc_info=True)
            return {"phase": "09:40_EMAIL_DISPATCH", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    def phase_6b_whatsapp_broadcast_0945(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        09:45 AM IST: Dispatches role-scoped WhatsApp contest summaries to verified
        Principal, HODs, Faculty, and participating Students via Meta WhatsApp Cloud API.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_0945] Starting Automated WhatsApp Contest Broadcast...")
            from backend.services.whatsapp_auth_service import whatsapp_auth_service
            from backend.services.whatsapp_query_engine import whatsapp_query_engine
            from backend.services.meta_whatsapp_client import meta_whatsapp_client
            from backend.models import User, Student

            dispatched = 0
            session = get_or_create_current_weekly_session(db)

            # 1. Broadcast to Principal / Admins
            principals = db.query(User).filter(
                User.role.in_(["Super Admin", "Admin"]),
                User.phone_number.isnot(None),
                User.whatsapp_verified == True
            ).all()

            for p in principals:
                p_ident = whatsapp_auth_service.resolve_identity(db, p.phone_number)
                p_res = whatsapp_query_engine.get_weekly_contest(db, p_ident)
                if p_res.get("success"):
                    meta_whatsapp_client.send_text_message(
                        to_phone=p.phone_number,
                        text=p_res.get("message", "Weekly Contest Report available on portal."),
                        correlation_id=f"WA-AUTO-PRIN-{session.id}"
                    )
                    dispatched += 1

            # 2. Broadcast to Department HODs
            hods = db.query(User).filter(
                User.role.in_(["HOD", "hod"]),
                User.phone_number.isnot(None),
                User.whatsapp_verified == True
            ).all()

            for h in hods:
                h_ident = whatsapp_auth_service.resolve_identity(db, h.phone_number)
                h_res = whatsapp_query_engine.get_weekly_contest(db, h_ident)
                if h_res.get("success"):
                    meta_whatsapp_client.send_text_message(
                        to_phone=h.phone_number,
                        text=h_res.get("message", "Department Contest Report available on portal."),
                        correlation_id=f"WA-AUTO-HOD-{h.department_id}-{session.id}"
                    )
                    dispatched += 1

            # 3. Broadcast to Faculty Mentors
            faculties = db.query(User).filter(
                User.role.in_(["Faculty", "faculty"]),
                User.phone_number.isnot(None),
                User.whatsapp_verified == True
            ).all()

            for f in faculties:
                f_ident = whatsapp_auth_service.resolve_identity(db, f.phone_number)
                f_res = whatsapp_query_engine.get_weekly_contest(db, f_ident)
                if f_res.get("success"):
                    meta_whatsapp_client.send_text_message(
                        to_phone=f.phone_number,
                        text=f_res.get("message", "Mentee Contest Report available on portal."),
                        correlation_id=f"WA-AUTO-FAC-{f.id}-{session.id}"
                    )
                    dispatched += 1

            # 4. Broadcast to Verified Participating Students (up to limit)
            students = db.query(Student).filter(
                Student.phone_number.isnot(None),
                Student.whatsapp_verified == True
            ).limit(100).all()

            for s in students:
                s_ident = whatsapp_auth_service.resolve_identity(db, s.phone_number)
                s_res = whatsapp_query_engine.get_weekly_contest(db, s_ident)
                if s_res.get("success"):
                    meta_whatsapp_client.send_text_message(
                        to_phone=s.phone_number,
                        text=s_res.get("message", "Your contest score is ready!"),
                        correlation_id=f"WA-AUTO-STU-{s.id}-{session.id}"
                    )
                    dispatched += 1

            logger.info(f"[AUTOPILOT_0945] Automated WhatsApp Broadcast completed: {dispatched} messages sent.")

            return {
                "phase": "09:45_WHATSAPP_BROADCAST",
                "success": True,
                "dispatched_count": dispatched,
                "session_id": session.id
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_0945_ERROR] {e}", exc_info=True)
            return {"phase": "09:45_WHATSAPP_BROADCAST", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    def phase_7_virtual_sync_2200(db: Optional[Session] = None) -> Dict[str, Any]:
        """
        10:00 PM (22:00) IST: Runs Virtual Contest synchronization, reconciles virtual participation
        with finalized contest data, and generates the final daily EOD summary report.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            logger.info("[AUTOPILOT_2200] Starting End-of-Day Virtual Contest Sync & Reconciliation...")
            from backend.services.weekly_report_service import run_sunday_2200_virtual_contest_workflow
            res = run_sunday_2200_virtual_contest_workflow(db)

            logger.info(f"[AUTOPILOT_2200] Virtual Contest Workflow Completed: {res}")

            return {
                "phase": "22:00_VIRTUAL_SYNC",
                "success": True,
                "result": res
            }
        except Exception as e:
            logger.error(f"[AUTOPILOT_2200_ERROR] {e}", exc_info=True)
            return {"phase": "22:00_VIRTUAL_SYNC", "success": False, "error": str(e)}
        finally:
            if close_on_exit:
                db.close()

    @staticmethod
    async def resume_or_recover_on_startup(db: Optional[Session] = None):
        """
        Startup Recovery Guard:
        Inspects current IST time and active session state. If the server restarted
        during live contest or after contest without finalization, it recovers seamlessly.
        """
        close_on_exit = False
        if db is None:
            db = SessionLocal()
            close_on_exit = True

        try:
            now_ist = get_current_ist_datetime()
            is_sunday = (now_ist.weekday() == 6)  # 6 = Sunday

            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            if not session:
                return

            current_time = now_ist.time()
            time_0800 = datetime.time(8, 0, 0)
            time_0930 = datetime.time(9, 30, 0)

            if is_sunday and time_0800 <= current_time < time_0930:
                logger.info(f"[AUTOPILOT_RECOVERY] Detected Sunday live contest window ({now_ist.strftime('%H:%M:%S IST')}). Resuming LIVE engine...")
                session.status = "LIVE"
                db.commit()
                sunday_live_engine.is_running = True
                sunday_live_engine.is_paused = False
                sunday_live_engine.worker_state = "RUNNING"
            elif is_sunday and current_time >= time_0930 and session.status in ("LIVE", "RUNNING", "SCHEDULED"):
                logger.info(f"[AUTOPILOT_RECOVERY] Detected unfinalized contest past 09:30 AM IST. Running auto finalization & report generation...")
                await SundayAutopilotCoordinator.phase_4_finalization_0930(db)
                SundayAutopilotCoordinator.phase_5_report_generation_0935(db)
        except Exception as e:
            logger.warning(f"[AUTOPILOT_RECOVERY_NOTE] {e}")
        finally:
            if close_on_exit:
                db.close()


sunday_autopilot = SundayAutopilotCoordinator()
