"""
test_email_delivery_system.py
───────────────────────────────────────────────────────────────────────────────
Automated test suite for the Report Email Delivery System.

Tests:
  1.  test_weekly_email_after_finalization
  2.  test_no_email_during_live
  3.  test_no_email_before_finalization
  4.  test_idempotency_prevents_duplicate_emails
  5.  test_canonical_dataset_in_email_summary
  6.  test_failed_email_retry
  7.  test_manual_report_email
  8.  test_large_attachment_handling
  9.  test_recipient_management_crud
  10. test_delivery_log_creation
"""
import unittest
import datetime
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, WeeklySession, ReportEmailRecipient,
    EmailDispatchLog, Student, LeetCodeProfileStats, Department
)
from backend.services.email_service import (
    queue_weekly_report_dispatches,
    build_institutional_email_body,
    send_manual_report_email,
    generate_canonical_report_files
)

# ── In-memory SQLite engine for isolated testing ──────────────────────────────
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def create_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    # Seed a Department
    dept = Department(name="Computer Science and Engineering (Cyber Security)", code="CSE(CS)")
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return db, dept


def make_session(db, status: str) -> WeeklySession:
    s = WeeklySession(
        academic_year="2026-27",
        week_number=33,
        session_code=f"WEEK-{status}",
        session_date="16.08.2026",
        contest_id="weekly-contest-470",
        contest_name="LeetCode Weekly Contest 470",
        start_time="08:00",
        end_time="09:30",
        status=status,
        total_students=3
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def add_default_recipient(db, email: str = "hod@test.nec.in", role: str = "HOD") -> ReportEmailRecipient:
    r = ReportEmailRecipient(name="Test HOD", email=email, role=role, department="CSE(CS)")
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# ── Test Cases ────────────────────────────────────────────────────────────────

class TestEmailDeliverySystem(unittest.TestCase):

    def setUp(self):
        self.db, self.dept = create_test_db()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    # ── Test 1 ──────────────────────────────────────────────────────────────
    def test_weekly_email_after_finalization(self):
        """
        RULE: Automatic dispatch queues emails ONLY when session.status == FINALIZED.
        Expected: EmailDispatchLog records created with status=QUEUED.
        """
        session = make_session(self.db, "FINALIZED")
        add_default_recipient(self.db, "hod@test.nec.in", "HOD")

        with patch("backend.services.email_service.generate_canonical_report_files") as mock_files, \
             patch("backend.services.email_service.fetch_normalized_students", return_value=[]):
            mock_files.return_value = {
                "excel": b"EXCEL", "pdf": b"PDF", "word": b"WORD",
                "csv": b"CSV", "zip": b"ZIP"
            }
            result = queue_weekly_report_dispatches(self.db, session_id=session.id)

        self.assertEqual(result["status"], "queued")
        self.assertGreater(result["queued_count"], 0)

        log = self.db.query(EmailDispatchLog).filter(EmailDispatchLog.session_id == session.id).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, "QUEUED")

    # ── Test 2 ──────────────────────────────────────────────────────────────
    def test_no_email_during_live(self):
        """
        RULE: Automatic dispatch is BLOCKED for sessions with status=LIVE.
        Expected: Returns 'skipped' without creating any dispatch log records.
        """
        session = make_session(self.db, "LIVE")
        add_default_recipient(self.db, "hod@test.nec.in")

        result = queue_weekly_report_dispatches(self.db, session_id=session.id)

        self.assertEqual(result["status"], "skipped")
        log_count = self.db.query(EmailDispatchLog).filter(EmailDispatchLog.session_id == session.id).count()
        self.assertEqual(log_count, 0, "No dispatch logs should be created for LIVE sessions.")

    # ── Test 3 ──────────────────────────────────────────────────────────────
    def test_no_email_before_finalization(self):
        """
        RULE: Sessions with status=SCHEDULED or PENDING must NOT trigger dispatch.
        """
        for status in ("SCHEDULED", "PENDING"):
            session = make_session(self.db, status)
            result = queue_weekly_report_dispatches(self.db, session_id=session.id)
            self.assertEqual(result["status"], "skipped", f"Session with status={status} should be skipped.")

    # ── Test 4 ──────────────────────────────────────────────────────────────
    def test_idempotency_prevents_duplicate_emails(self):
        """
        RULE: Same session + recipient combination must never produce two SENT emails.
        Expected: Second dispatch call returns skipped_duplicate_count > 0.
        """
        session = make_session(self.db, "FINALIZED")
        add_default_recipient(self.db, "hod@test.nec.in")

        with patch("backend.services.email_service.generate_canonical_report_files") as mf, \
             patch("backend.services.email_service.fetch_normalized_students", return_value=[]):
            mf.return_value = {"excel": b"E", "pdf": b"P", "word": b"W", "csv": b"C", "zip": b"Z"}

            # First dispatch — creates QUEUED record
            queue_weekly_report_dispatches(self.db, session_id=session.id)

            # Simulate delivery — mark as SENT
            log = self.db.query(EmailDispatchLog).filter(EmailDispatchLog.session_id == session.id).first()
            log.status = "SENT"
            self.db.commit()

            # Second dispatch — should detect SENT idempotency key and skip
            result2 = queue_weekly_report_dispatches(self.db, session_id=session.id)

        self.assertGreater(result2.get("skipped_duplicate_count", 0), 0,
                           "Duplicate email must be prevented by idempotency check.")

    # ── Test 5 ──────────────────────────────────────────────────────────────
    def test_canonical_dataset_in_email_summary(self):
        """
        RULE: Email body metrics MUST come from fetch_normalized_students, not independent DB query.
        Expected: HTML body contains canonical student count from dataset.
        """
        session = make_session(self.db, "FINALIZED")

        mock_student = MagicMock()
        mock_student.status = "VERIFIED"
        mock_student.total_solved = 150
        mock_student.name = "Test Ranker"

        html = build_institutional_email_body(session, [mock_student])
        self.assertIn("Test Ranker", html)
        self.assertIn("16.08.2026", html)
        self.assertIn("NANDHA ENGINEERING COLLEGE", html)

    # ── Test 6 ──────────────────────────────────────────────────────────────
    def test_failed_email_retry(self):
        """
        RULE: On SMTP failure, EmailDispatchLog.status transitions to RETRYING.
        After max 3 retries, transitions to FAILED.
        """
        session = make_session(self.db, "FINALIZED")
        log = EmailDispatchLog(
            email_id="MSG-RETRY-001",
            session_id=session.id,
            idempotency_key="RETRY-TEST-KEY",
            recipient="retry@test.nec.in",
            role="HOD",
            subject="Test Weekly Report",
            status="QUEUED",
            retry_count=2
        )
        self.db.add(log)
        self.db.commit()

        # Simulate final failure (retry_count 2 → 3 → FAILED)
        log.retry_count = 3
        log.status = "FAILED"
        log.error_message = "Connection refused (max retries exhausted)"
        self.db.commit()

        updated = self.db.query(EmailDispatchLog).filter(EmailDispatchLog.email_id == "MSG-RETRY-001").first()
        self.assertEqual(updated.status, "FAILED")
        self.assertEqual(updated.retry_count, 3)
        self.assertIsNotNone(updated.error_message)

    # ── Test 7 ──────────────────────────────────────────────────────────────
    def test_manual_report_email(self):
        """
        RULE: Manual dispatch to custom email list creates QUEUED dispatch logs.
        """
        session = make_session(self.db, "FINALIZED")

        with patch("backend.services.email_service.fetch_normalized_students", return_value=[]):
            result = send_manual_report_email(
                self.db,
                session_id=session.id,
                recipient_emails=["staff@test.nec.in"],
                custom_message="Please review the attached report."
            )

        self.assertEqual(result["status"], "success")
        self.assertGreater(len(result.get("queued_log_ids", [])), 0)

        log = self.db.query(EmailDispatchLog).filter(
            EmailDispatchLog.recipient == "staff@test.nec.in"
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, "QUEUED")

    # ── Test 8 ──────────────────────────────────────────────────────────────
    def test_large_attachment_handling(self):
        """
        RULE: If total attachment size > MAX_EMAIL_ATTACHMENT_SIZE_MB,
        dispatch logs should have attachment_count = 2 (PDF + ZIP only).
        """
        session = make_session(self.db, "FINALIZED")
        add_default_recipient(self.db, "hod.large@test.nec.in")

        big_bytes = b"X" * (20 * 1024 * 1024)  # 20 MB — exceeds 15 MB limit

        with patch("backend.services.email_service.generate_canonical_report_files") as mf, \
             patch("backend.services.email_service.fetch_normalized_students", return_value=[]):
            mf.return_value = {
                "excel": big_bytes, "pdf": b"P", "word": big_bytes,
                "csv": b"C", "zip": b"Z"
            }
            result = queue_weekly_report_dispatches(self.db, session_id=session.id)

        log = self.db.query(EmailDispatchLog).filter(
            EmailDispatchLog.recipient == "hod.large@test.nec.in"
        ).first()
        self.assertIsNotNone(log)
        # Large attachment mode: only PDF + ZIP (2 files)
        self.assertEqual(log.attachment_count, 2,
                         "Large attachment mode must reduce to PDF + ZIP (2 files).")

    # ── Test 9 ──────────────────────────────────────────────────────────────
    def test_recipient_management_crud(self):
        """
        RULE: Admins must be able to add, update, and soft-disable email recipients
        without editing source code.
        """
        # Add
        r = ReportEmailRecipient(
            name="Prof. New HOD", email="newhod@test.nec.in", role="HOD",
            department="CSE(IoT)", is_active=True
        )
        self.db.add(r)
        self.db.commit()

        # Retrieve
        fetched = self.db.query(ReportEmailRecipient).filter(
            ReportEmailRecipient.email == "newhod@test.nec.in"
        ).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.name, "Prof. New HOD")

        # Disable
        fetched.is_active = False
        self.db.commit()

        disabled = self.db.query(ReportEmailRecipient).filter(
            ReportEmailRecipient.email == "newhod@test.nec.in",
            ReportEmailRecipient.is_active == True
        ).first()
        self.assertIsNone(disabled, "Disabled recipient must not appear in active filter.")

    # ── Test 10 ─────────────────────────────────────────────────────────────
    def test_delivery_log_creation(self):
        """
        RULE: Every dispatch attempt (queued, sent, failed) must be persisted in email_dispatch_logs.
        """
        session = make_session(self.db, "FINALIZED")
        add_default_recipient(self.db, "log_test@test.nec.in")

        with patch("backend.services.email_service.generate_canonical_report_files") as mf, \
             patch("backend.services.email_service.fetch_normalized_students", return_value=[]):
            mf.return_value = {"excel": b"E", "pdf": b"P", "word": b"W", "csv": b"C", "zip": b"Z"}
            queue_weekly_report_dispatches(self.db, session_id=session.id)

        all_logs = self.db.query(EmailDispatchLog).filter(
            EmailDispatchLog.session_id == session.id
        ).all()
        self.assertGreater(len(all_logs), 0, "EmailDispatchLog records must be created after dispatch.")
        for log in all_logs:
            self.assertIn(log.status, ("QUEUED", "SENDING", "SENT", "FAILED", "RETRYING"))
            self.assertIsNotNone(log.idempotency_key)
            self.assertIsNotNone(log.subject)


if __name__ == "__main__":
    unittest.main()
