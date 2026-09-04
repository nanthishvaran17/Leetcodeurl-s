"""
contest_non_attendance_service.py
================================================================================
CONTEST NON-ATTENDANCE EMAIL NOTIFICATION SERVICE
================================================================================
Deterministic, evidence-based non-attendance email dispatcher with:
1. Strict eligibility truth gates (Zero false accusation guarantee).
2. Canonical contest window boundary compliance (UTC ↔ Asia/Kolkata).
3. 100% idempotent dispatch (student_id + contest_id de-duplication).
4. Academic institutional email styling (Zero emojis, zero decorative icons).
5. Comprehensive audit logging and roster accounting.
"""

import datetime
import zoneinfo
from typing import Dict, Any, List, Optional, Tuple, Union
from sqlalchemy.orm import Session, joinedload

from backend.models import (
    Student, WeeklySession, EmailDispatchLog, WeeklyPublicResult, WeeklyVirtualResult
)
from backend.services.email_service import (
    send_email, validate_recipient_email
)
from backend.services.email_templates import generate_professional_template
from backend.services.contest_reconciliation_service import (
    ContestReconciliationService, CanonicalAttendanceState, EvidenceLevel
)
from backend.logger import logger

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC_TZ = zoneinfo.ZoneInfo("UTC")


def build_non_attendance_email_content(
    student_name: str,
    contest_name: str,
    contest_date: str,
    start_time: str,
    end_time: str,
    leetcode_username: str
) -> Tuple[str, str, str]:
    """
    Constructs the official, clean academic non-attendance notification.
    Guaranteed: ZERO emojis, ZERO decorative icons, ZERO marketing graphics.
    """
    subject = "Weekly LeetCode Contest — Non-Attendance Notification"
    title = "Contest Participation Verification"

    clean_username = str(leetcode_username).strip() or "N/A"

    content = f"""
    <p style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: #1e293b;">
        Dear {student_name},
    </p>
    <p style="margin-top: 0; margin-bottom: 20px; font-size: 14px; color: #334155; line-height: 1.6;">
        The participation verification for the following official LeetCode Weekly Contest has been completed.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 14px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            Contest Details
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
                <td style="padding: 6px 0; color: #64748b; width: 40%; font-weight: 600;">Contest:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{contest_name}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Contest Date:</td>
                <td style="padding: 6px 0; color: #0f172a;">{contest_date}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Official Contest Window:</td>
                <td style="padding: 6px 0; color: #0f172a;">{start_time} – {end_time} IST</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">LeetCode Username:</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">{clean_username}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Participation Status:</td>
                <td style="padding: 6px 0; color: #b91c1c; font-weight: 700;">Not Attended</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Verification Status:</td>
                <td style="padding: 6px 0; color: #334155; line-height: 1.5;">No valid public contest participation evidence was found during the official contest window.</td>
            </tr>
        </table>
    </div>

    <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #475569; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Required Action
        </h4>
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #334155; line-height: 1.5;">
            If you were unable to participate in the contest, please contact your Account Coordinator, Faculty Coordinator, or Contest Proctor and provide the reason for your non-attendance.
        </p>
        <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
            If you believe this status is incorrect, please contact the appropriate coordinator for verification.
        </p>
    </div>

    <p style="margin-top: 24px; margin-bottom: 4px; font-size: 14px; color: #475569;">
        Regards,
    </p>
    <p style="margin-top: 0; margin-bottom: 2px; font-size: 14px; font-weight: 700; color: #0f172a;">
        Nandha LeetCode Intelligence
    </p>
    <p style="margin-top: 0; font-size: 13px; color: #64748b;">
        Contest Monitoring System
    </p>
    """

    html_body = generate_professional_template(title, content)

    plain_text_body = f"""Dear {student_name},

Our contest monitoring system has completed the participation verification for the following official LeetCode Weekly Contest.

Contest Details
--------------------------------------------------
Contest: {contest_name}
Contest Date: {contest_date}
Official Contest Window: {start_time} – {end_time} IST
LeetCode Username: {clean_username}
Participation Status: Not Attended
Verification Status: No valid public contest participation evidence was found during the official contest window.

Required Action
--------------------------------------------------
If you were unable to participate in the contest, please contact your Account Coordinator, Faculty Coordinator, or Contest Proctor and provide the reason for your non-attendance.

If you believe this status is incorrect, please contact the appropriate coordinator for verification.

Regards,
Nandha LeetCode Intelligence
Contest Monitoring System
"""

    return subject, html_body, plain_text_body


class ContestNonAttendanceService:
    """
    Authoritative service governing non-attendance email eligibility and execution.
    """

    @classmethod
    def check_eligibility(
        cls,
        student: Student,
        session: WeeklySession,
        classification_record: Dict[str, Any],
        is_snapshot_frozen: bool = True
    ) -> Tuple[bool, str]:
        """
        Evaluates the Strict Eligibility Truth Gates.
        Returns: (is_eligible, reason_or_disqualification_code)
        """
        # Gate 0: Snapshot Frozen Check
        if not is_snapshot_frozen:
            return False, "SNAPSHOT_NOT_FROZEN: Canonical contest snapshot is not yet finalized/frozen."

        # Gate 1: Active Student
        if getattr(student, "is_active", True) is False:
            return False, "STUDENT_INACTIVE: Student is not active on institutional roster."

        # Gate 2: Valid Routable Email
        email_str = getattr(student, "email", "") or ""
        is_valid_email, status, err = validate_recipient_email(email_str)
        if not is_valid_email:
            return False, f"INVALID_EMAIL: {err or 'Missing or invalid student email.'}"

        # Gate 3: Valid LeetCode Handle
        raw_u = getattr(student, "username", "") or ""
        u_clean = str(raw_u).strip()
        u_upper = u_clean.upper()
        if not u_clean or len(u_clean) < 2 or u_upper in ("UNLINKED", "NONE", "NULL", "UNDEFINED", "—", "-"):
            return False, "DATA_ERROR: LeetCode handle is missing, unlinked, or invalid."

        # Gate 4: Session State & Timing
        if not session or not session.contest_name:
            return False, "SESSION_INVALID: Canonical contest session metadata missing."

        # Gate 5: Non-Error / Non-Pending Verification Status
        att_state = classification_record.get("attendance_state") or classification_record.get("attendance_status")
        if isinstance(att_state, str):
            att_state = att_state.strip().upper()

        if att_state in ("SOURCE_UNAVAILABLE", "FETCH_ERROR", "TIMEOUT"):
            return False, "SOURCE_UNAVAILABLE: Contest API returned error/timeout. Never accuse absent."

        if att_state in ("UNKNOWN_PENDING_EVIDENCE", "PENDING", "ATTENDANCE_EVIDENCE_PENDING"):
            return False, "PENDING_EVIDENCE: Evidence verification not yet conclusive."

        if att_state in ("DATA_ERROR", "PROFILE_ERROR"):
            return False, "DATA_ERROR: Student profile has data inconsistencies."

        # Gate 6: Attended Live or Virtual Check
        if att_state in ("LIVE_ATTENDED", "PUBLIC", "PUBLIC_ATTENDED", "ATTENDED") or classification_record.get("is_live") is True:
            return False, "LIVE_ATTENDED: Student verified as live contest participant."

        if att_state in ("VIRTUAL_ATTENDED", "VIRTUAL", "POST_CONTEST_PRACTICE") or classification_record.get("is_virtual") is True:
            return False, "VIRTUAL_ATTENDED: Student participated virtually / post-contest."

        # Gate 7: Strict NOT_ATTENDED Confirmation
        if att_state != CanonicalAttendanceState.NOT_ATTENDED and att_state != "NOT_ATTENDED":
            return False, f"INELIGIBLE_STATE: Attendance state '{att_state}' does not qualify for non-attendance notice."

        return True, "ELIGIBLE"

    @classmethod
    def is_already_dispatched(
        cls,
        student_id: int,
        session_id: int,
        db: Session
    ) -> bool:
        """Checks if a non-attendance email was already sent or queued for this contest."""
        idempotency_key = f"contest_non_attendance_{student_id}_{session_id}"
        existing = db.query(EmailDispatchLog).filter(
            EmailDispatchLog.idempotency_key == idempotency_key,
            EmailDispatchLog.status.in_(["SENT", "SMTP_ACCEPTED", "DELIVERED", "QUEUED", "SENDING"])
        ).first()
        return existing is not None

    @classmethod
    def send_single_non_attendance_email(
        cls,
        student_id: int,
        session_id: int,
        db: Session,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates eligibility and sends a non-attendance notification to a single student.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {"success": False, "status": "STUDENT_NOT_FOUND", "message": f"Student ID {student_id} not found."}

        session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session_obj:
            session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        if not session_obj:
            return {"success": False, "status": "SESSION_NOT_FOUND", "message": f"Session ID {session_id} not found."}

        # Run canonical reconciliation for this session
        reconcile_res = ContestReconciliationService.reconcile_contest(session_obj, db, dry_run=True)
        records = reconcile_res.get("records", [])
        student_rec = next((r for r in records if r.get("student_id") == student_id), None)

        if not student_rec:
            # Construct standard absent check fallback
            student_rec = ContestReconciliationService.classify_student(student, None, [], None)
            student_rec["student_id"] = student_id

        # Check Eligibility
        is_eligible, reason = cls.check_eligibility(student, session_obj, student_rec)
        if not is_eligible:
            return {
                "success": False,
                "status": "INELIGIBLE",
                "reason": reason,
                "student_id": student.id,
                "reg_no": student.reg_no
            }

        # Check Idempotency
        if cls.is_already_dispatched(student.id, session_obj.id, db):
            return {
                "success": True,
                "status": "ALREADY_SENT",
                "message": f"Non-attendance email already dispatched for Student {student.reg_no}.",
                "student_id": student.id,
                "reg_no": student.reg_no
            }

        contest_name = session_obj.contest_name or f"Weekly Contest {session_obj.id}"
        contest_date = session_obj.session_date or datetime.datetime.now(IST_TZ).strftime("%d.%m.%Y")
        start_time = session_obj.start_time or "08:00"
        end_time = session_obj.end_time or "09:30"

        subject, html_body, plain_text = build_non_attendance_email_content(
            student_name=student.name,
            contest_name=contest_name,
            contest_date=contest_date,
            start_time=start_time,
            end_time=end_time,
            leetcode_username=student.username
        )

        idempotency_key = f"contest_non_attendance_{student.id}_{session_obj.id}"

        if dry_run:
            return {
                "success": True,
                "status": "DRY_RUN_ELIGIBLE",
                "recipient": student.email,
                "subject": subject,
                "idempotency_key": idempotency_key,
                "student_id": student.id,
                "reg_no": student.reg_no
            }

        # Dispatch via institutional email transporter
        send_ok, send_msg = send_email(
            recipient=student.email,
            subject=subject,
            html_body=html_body,
            text_body=plain_text
        )

        # Record in EmailDispatchLog
        dispatch_log = EmailDispatchLog(
            email_id=f"NOTIFY-ABSENT-{student.id}-{session_obj.id}-{int(datetime.datetime.now(UTC_TZ).timestamp())}",
            report_id=f"Contest_{session_obj.id}",
            session_id=session_obj.id,
            idempotency_key=idempotency_key,
            recipient=student.email,
            role="STUDENT",
            subject=subject,
            dispatch_type="AUTOMATED_NON_ATTENDANCE",
            provider="SMTP_RELAY",
            status="SENT" if send_ok else "FAILED",
            error_message=None if send_ok else str(send_msg),
            sent_at=datetime.datetime.now(UTC_TZ) if send_ok else None
        )
        db.add(dispatch_log)
        db.commit()

        return {
            "success": send_ok,
            "status": "SENT" if send_ok else "DISPATCH_FAILED",
            "message": send_msg,
            "recipient": student.email,
            "idempotency_key": idempotency_key,
            "student_id": student.id,
            "reg_no": student.reg_no
        }

    @classmethod
    def dispatch_contest_non_attendance_batch(
        cls,
        session_id: int,
        db: Session,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Executes full-roster evaluation and dispatches non-attendance notifications
        strictly to verified absent students following canonical snapshot reconciliation.
        """
        session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session_obj:
            session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        if not session_obj:
            return {"success": False, "error": f"Session ID {session_id} not found."}

        # 1. Run authoritative reconciliation
        reconcile_res = ContestReconciliationService.reconcile_contest(session_obj, db, dry_run=True)
        if not reconcile_res.get("success") and not reconcile_res.get("publication_allowed"):
            return {
                "success": False,
                "error": "Cannot dispatch emails: Contest reconciliation invariants failed.",
                "reconciliation_status": reconcile_res.get("reconciliation_status")
            }

        records = reconcile_res.get("records", [])
        students = db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).all()
        student_map = {s.id: s for s in students}

        sent_list = []
        already_sent_list = []
        ineligible_list = []
        failed_list = []

        ineligible_breakdown = {
            "LIVE_ATTENDED": 0,
            "VIRTUAL_ATTENDED": 0,
            "DATA_ERROR": 0,
            "SOURCE_UNAVAILABLE": 0,
            "PENDING_EVIDENCE": 0,
            "INVALID_EMAIL": 0,
            "OTHER": 0
        }

        for rec in records:
            s_id = rec.get("student_id")
            student = student_map.get(s_id)
            if not student:
                continue

            is_eligible, reason = cls.check_eligibility(student, session_obj, rec)
            if not is_eligible:
                ineligible_list.append({"student_id": s_id, "reg_no": student.reg_no, "reason": reason})
                if "LIVE_ATTENDED" in reason:
                    ineligible_breakdown["LIVE_ATTENDED"] += 1
                elif "VIRTUAL_ATTENDED" in reason:
                    ineligible_breakdown["VIRTUAL_ATTENDED"] += 1
                elif "DATA_ERROR" in reason:
                    ineligible_breakdown["DATA_ERROR"] += 1
                elif "SOURCE_UNAVAILABLE" in reason:
                    ineligible_breakdown["SOURCE_UNAVAILABLE"] += 1
                elif "PENDING_EVIDENCE" in reason:
                    ineligible_breakdown["PENDING_EVIDENCE"] += 1
                elif "INVALID_EMAIL" in reason:
                    ineligible_breakdown["INVALID_EMAIL"] += 1
                else:
                    ineligible_breakdown["OTHER"] += 1
                continue

            # Check Idempotency
            if cls.is_already_dispatched(student.id, session_obj.id, db):
                already_sent_list.append({"student_id": s_id, "reg_no": student.reg_no})
                continue

            # Dispatch
            res = cls.send_single_non_attendance_email(student.id, session_obj.id, db, dry_run=dry_run)
            if res.get("success"):
                sent_list.append({"student_id": s_id, "reg_no": student.reg_no, "email": student.email})
            else:
                failed_list.append({"student_id": s_id, "reg_no": student.reg_no, "error": res.get("message")})

        return {
            "success": True,
            "session_id": session_obj.id,
            "contest_name": session_obj.contest_name,
            "dry_run": dry_run,
            "total_evaluated": len(records),
            "emails_dispatched": len(sent_list),
            "emails_already_sent": len(already_sent_list),
            "ineligible_count": len(ineligible_list),
            "failed_count": len(failed_list),
            "ineligible_breakdown": ineligible_breakdown,
            "timestamp": datetime.datetime.now(IST_TZ).isoformat()
        }
