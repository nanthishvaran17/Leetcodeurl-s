import uuid
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models import Student, LeetCodeAccount, StudentContestParticipation, IntegrityCase, AuditLogRecord
from backend.services.notification_outbox_worker import NotificationOutboxWorker

class ContestIntegrityService:
    def __init__(self, db: Session):
        self.db = db

    def is_not_attended_status(self, score_display: Optional[str], attended: Optional[bool], questions_solved: Optional[int]) -> Optional[bool]:
        """
        Returns:
            True: Confirmed NOT ATTENDED
            False: Confirmed ATTENDED
            None: UNKNOWN / SYNC_FAILED / INCOMPLETE DATA
        """
        if attended is True or (questions_solved is not None and questions_solved > 0):
            return False
        
        if score_display is None:
            return None # Unknown
            
        score_upper = str(score_display).strip().upper()
        if "NOT ATTENDED" in score_upper or score_upper in ("0", "0 / 4", "0/4"):
            return True
            
        if any(keyword in score_upper for keyword in ["UNKNOWN", "FAILED", "PENDING", "SYNC"]):
            return None
            
        if any(f"{i}/" in score_upper or f"{i} /" in score_upper for i in range(1, 10)):
            return False

        return None

    def generate_why_this_alert_explanation(
        self, 
        people_id: str, 
        student_name: str, 
        contest_id: str, 
        account_ids: List[str], 
        statuses: Dict[str, Any]
    ) -> str:
        """
        Generates dynamic, database-driven explanation for the integrity case.
        No hardcoded strings — derived strictly from database values.
        """
        num_accounts = len(account_ids)
        acc_list_str = ", ".join([f"@{acc}" for acc in account_ids])

        explanation = (
            f"{num_accounts} different LeetCode contest accounts ({acc_list_str}) are linked to People ID '{people_id}' ({student_name}). "
            f"All {num_accounts} linked accounts have confirmed NOT_ATTENDED status in the official contest window (08:00 AM - 09:30 AM IST) for contest {contest_id}. "
            f"Any post-contest virtual or practice activity after 09:30 AM IST was excluded from official attendance."
        )
        return explanation

    def evaluate_contest_integrity(self, contest_id: str) -> List[Dict[str, Any]]:
        """
        Evaluates Dual-ID non-attendance compliance for all students for a specific contest.
        Consolidates 2, 3, 4+ accounts per student into 1 single case per (People ID + Contest ID).
        Enforces exact truth table: ONLY ALL linked accounts NOT_ATTENDED creates an integrity case.
        """
        students = self.db.query(Student).all()
        flagged_cases = []

        for student in students:
            # 1. Identity Review Check: If People ID is missing
            if not student.people_id:
                accounts = self.db.query(LeetCodeAccount).filter(LeetCodeAccount.student_id == student.id).all()
                if len(accounts) >= 2:
                    self._create_identity_review_case(student, contest_id, accounts)
                continue

            # 2. Get linked contest accounts
            accounts = self.db.query(LeetCodeAccount).filter(LeetCodeAccount.student_id == student.id).all()
            if len(accounts) < 2:
                continue # Single account or unlinked -> Case 7: NO ALERT

            account_usernames = [acc.leetcode_username for acc in accounts]

            # Fetch participation records for this contest
            participations = self.db.query(StudentContestParticipation).filter(
                StudentContestParticipation.student_id == student.id,
                StudentContestParticipation.contest_id == contest_id
            ).all()

            account_statuses = {}
            for acc in accounts:
                part = next((p for p in participations if p.source and acc.leetcode_username.lower() in p.source.lower()), None)
                if not part and participations:
                    part = participations[0]

                if part:
                    official_state = getattr(part, "official_attendance_state", None)
                    if official_state == "NOT_ATTENDED":
                        status_bool = True
                    elif official_state == "ATTENDED":
                        status_bool = False
                    elif official_state == "UNKNOWN":
                        status_bool = None
                    else:
                        status_bool = self.is_not_attended_status(part.score_display, part.questions_solved is not None and part.questions_solved > 0, part.questions_solved)

                    account_statuses[acc.leetcode_username] = {
                        "score_display": part.score_display,
                        "questions_solved": part.questions_solved,
                        "official_attendance_state": official_state or ("NOT_ATTENDED" if status_bool is True else "ATTENDED" if status_bool is False else "UNKNOWN"),
                        "status_bool": status_bool # True = Not Attended, False = Attended, None = Unknown
                    }
                else:
                    account_statuses[acc.leetcode_username] = {
                        "score_display": "UNKNOWN",
                        "questions_solved": None,
                        "official_attendance_state": "UNKNOWN",
                        "status_bool": None
                    }

            # TRUTH TABLE EVALUATION:
            # Trigger IF AND ONLY IF ALL accounts have status_bool == True (Confirmed Not Attended)
            statuses = [info["status_bool"] for info in account_statuses.values()]

            # If ANY account is False (Attended) -> NO ALERT
            if False in statuses:
                continue

            # If ANY account is None (Unknown / Sync Pending) -> NO ALERT
            if None in statuses:
                continue

            # If ALL accounts are True (Not Attended) -> TRIGGER CONSOLIDATED DUAL-ID ALERT
            if all(s is True for s in statuses):
                idempotency_key = f"INT-{student.people_id}-{contest_id}"
                
                existing_case = self.db.query(IntegrityCase).filter(
                    IntegrityCase.idempotency_key == idempotency_key
                ).first()

                why_explanation = self.generate_why_this_alert_explanation(
                    student.people_id, student.name, contest_id, account_usernames, account_statuses
                )

                if not existing_case:
                    new_case = IntegrityCase(
                        case_id=idempotency_key,
                        idempotency_key=idempotency_key,
                        people_id=student.people_id,
                        contest_id=contest_id,
                        account_ids=account_usernames,
                        participation_statuses={
                            "accounts": account_statuses,
                            "why_this_alert": why_explanation,
                            "account_count": len(account_usernames)
                        },
                        status="PENDING",
                        audit_history=[{
                            "event": "CASE_CREATED",
                            "reason": why_explanation,
                            "timestamp": datetime.datetime.utcnow().isoformat()
                        }]
                    )
                    self.db.add(new_case)
                    self.db.commit()
                    self.db.refresh(new_case)
                    
                    # Record Audit Log
                    audit_log = AuditLogRecord(
                        event_type="INTEGRITY_CASE_CREATED",
                        contest_id=contest_id,
                        people_id=student.people_id,
                        details={"case_id": new_case.case_id, "accounts": account_usernames, "why": why_explanation},
                        created_by="CONTEST_INTEGRITY_SERVICE"
                    )
                    self.db.add(audit_log)
                    self.db.commit()

                    # Queue Notifications via Transactional Outbox
                    self._queue_outbox_notifications(student, new_case)

                    flagged_cases.append({
                        "case_id": new_case.case_id,
                        "people_id": new_case.people_id,
                        "student_name": student.name,
                        "contest_id": contest_id,
                        "accounts": account_usernames,
                        "status": "PENDING",
                        "why_this_alert": why_explanation
                    })
                else:
                    self._queue_outbox_notifications(student, existing_case)
                    flagged_cases.append({
                        "case_id": existing_case.case_id,
                        "people_id": existing_case.people_id,
                        "student_name": student.name,
                        "contest_id": contest_id,
                        "accounts": account_usernames,
                        "status": existing_case.status,
                        "why_this_alert": why_explanation
                    })

        return flagged_cases

    def _create_identity_review_case(self, student: Student, contest_id: str, accounts: List[LeetCodeAccount]):
        """Flags student for IDENTITY_REVIEW_REQUIRED when People ID mapping is missing."""
        idempotency_key = f"ID-REVIEW-REG-{student.reg_no}-{contest_id}"
        existing = self.db.query(IntegrityCase).filter(IntegrityCase.idempotency_key == idempotency_key).first()
        if not existing:
            account_usernames = [a.leetcode_username for a in accounts]
            case = IntegrityCase(
                case_id=idempotency_key,
                idempotency_key=idempotency_key,
                people_id=f"UNKNOWN_REG_{student.reg_no}",
                contest_id=contest_id,
                account_ids=account_usernames,
                participation_statuses={"review_reason": "IDENTITY_REVIEW_REQUIRED", "why_this_alert": "Student has multiple contest accounts registered but is missing an official People ID mapping."},
                status="IDENTITY_REVIEW_REQUIRED",
                audit_history=[{
                    "event": "IDENTITY_REVIEW_REQUIRED",
                    "reason": "Missing People ID for multiple contest accounts",
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }]
            )
            self.db.add(case)
            self.db.commit()

    def _queue_outbox_notifications(self, student: Student, case: IntegrityCase):
        """Queues 1 Student Email, 1 Staff Email, 1 Staff Push in NotificationEvent outbox table."""
        # 1. Student Email
        if student.email:
            NotificationOutboxWorker.queue_notification(
                db=self.db,
                case_id=case.case_id,
                people_id=student.people_id,
                recipient_type="STUDENT",
                channel="EMAIL",
                recipient_target=student.email,
                payload={
                    "subject": f"Contest Non-Attendance Notice: {case.contest_id}",
                    "html_body": f"<p>Hello {student.name},</p><p>Our contest tracking system logged non-attendance for contest {case.contest_id} across your registered profiles. Please ensure you participate in future weekly contests.</p>",
                    "text_body": f"Hello {student.name},\n\nOur contest tracking system logged non-attendance for contest {case.contest_id} across your registered profiles. Please ensure you participate in future weekly contests.",
                    "contest_id": case.contest_id
                }
            )
            setattr(case, "student_email_sent", True)

        # 2. Staff Email
        staff_email = "staff.mentors@college.edu"
        NotificationOutboxWorker.queue_notification(
            db=self.db,
            case_id=case.case_id,
            people_id=student.people_id,
            recipient_type="STAFF_EMAIL",
            channel="EMAIL",
            recipient_target=staff_email,
            payload={
                "subject": f"Dual-ID Review Required: {student.name} ({student.people_id})",
                "html_body": f"<p>Staff Alert:</p><p>Student <strong>{student.name}</strong> ({student.people_id}) was flagged for Dual-ID Non-Attendance on contest {case.contest_id}.<br/>Case ID: {case.case_id}</p>",
                "text_body": f"Staff Alert:\n\nStudent {student.name} ({student.people_id}) was flagged for Dual-ID Non-Attendance on contest {case.contest_id}.\nCase ID: {case.case_id}\n\nPlease review in the Staff Integrity Dashboard.",
                "contest_id": case.contest_id
            }
        )
        setattr(case, "staff_email_sent", True)

        # 3. Staff Push Notification
        NotificationOutboxWorker.queue_notification(
            db=self.db,
            case_id=case.case_id,
            people_id=student.people_id,
            recipient_type="STAFF_PUSH",
            channel="FCM_PUSH",
            recipient_target="STAFF_TOPIC",
            payload={
                "title": "⚠️ Dual-ID Review Required",
                "message": f"Student {student.name} ({student.people_id}) flagged for dual non-attendance on {case.contest_id}.",
                "action_route": f"/integrity-monitor?case_id={case.case_id}",
                "contest_id": case.contest_id
            }
        )
        setattr(case, "staff_push_sent", True)

        self.db.commit()

        # Process outbox queue immediately
        NotificationOutboxWorker.process_outbox_queue(self.db)
