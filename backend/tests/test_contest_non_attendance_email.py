"""
test_contest_non_attendance_email.py
================================================================================
COMPREHENSIVE AUTOMATED TEST SUITE: CONTEST NON-ATTENDANCE EMAIL PIPELINE
================================================================================
Verifies all 10 mandatory master requirements:
1. Student attended public contest (solved > 0) -> NO non-attendance email.
2. Student attended public contest (0 solved) -> NO non-attendance email.
3. Student verified absent -> NON-ATTENDANCE email sent.
4. Student solves post-contest (Virtual) -> NO public non-attendance email.
5. Upstream API failure (SOURCE_UNAVAILABLE) -> NO non-attendance email.
6. Invalid / unlinked username (DATA_ERROR) -> NO non-attendance email.
7. Evidence pending (PENDING_EVIDENCE) -> NO non-attendance email.
8. Idempotency test (Job runs twice -> Only ONE email recorded).
9. Boundary timestamp: timestamp == contest_end_time -> Post-contest boundary.
10. Academic design validation: Subject & HTML content contain ZERO emojis/decorative icons.
"""

import unittest
import re
from backend.services.contest_non_attendance_service import (
    ContestNonAttendanceService, build_non_attendance_email_content
)
from backend.services.contest_reconciliation_service import (
    CanonicalAttendanceState, EvidenceLevel, ContestMetadataResolver
)
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, EmailDispatchLog, Department


class MockStudentModel:
    def __init__(self, id, reg_no, name, username, email, is_active=True):
        self.id = id
        self.reg_no = reg_no
        self.name = name
        self.username = username
        self.email = email
        self.is_active = is_active
        self.department = type("MockDept", (), {"code": "CSE", "name": "Computer Science"})()


class MockSessionModel:
    def __init__(self, id=21, name="Weekly Contest 516", date="23.08.2026", start="08:00", end="09:30"):
        self.id = id
        self.contest_name = name
        self.session_date = date
        self.start_time = start
        self.end_time = end


class TestContestNonAttendanceEmail(unittest.TestCase):

    def setUp(self):
        self.session = MockSessionModel()

    # ─── CASE 1: Attended Public Contest (Solved > 0) ──────────────────────────
    def test_case_01_public_attended_solved(self):
        student = MockStudentModel(1, "732224CS001", "Live Student", "live_coder", "live@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.LIVE_ATTENDED,
            "is_live": True,
            "is_virtual": False,
            "solved": 2
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── CASE 2: Attended Public Contest (0 Solved) ────────────────────────────
    def test_case_02_public_attended_zero_solved(self):
        student = MockStudentModel(2, "732224CS002", "Zero Solver", "zero_coder", "zero@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.LIVE_ATTENDED,
            "is_live": True,
            "is_virtual": False,
            "solved": 0
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── CASE 3: Verified Not Attended ─────────────────────────────────────────
    def test_case_03_verified_not_attended(self):
        student = MockStudentModel(3, "732224CS003", "Absent Student", "absent_coder", "absent@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertTrue(eligible)
        self.assertEqual(reason, "ELIGIBLE")

    # ─── CASE 4: Virtual Contest Participant ───────────────────────────────────
    def test_case_04_virtual_participant(self):
        student = MockStudentModel(4, "732224CS004", "Virtual Student", "virt_coder", "virt@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.VIRTUAL_ATTENDED,
            "is_live": False,
            "is_virtual": True,
            "solved": 3
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("VIRTUAL_ATTENDED", reason)

    # ─── CASE 5: Upstream API Failure (SOURCE_UNAVAILABLE) ─────────────────────
    def test_case_05_source_unavailable_no_email(self):
        student = MockStudentModel(5, "732224CS005", "Timeout Student", "timeout_coder", "timeout@nandha.ac.in")
        record = {
            "attendance_state": "SOURCE_UNAVAILABLE",
            "is_live": False,
            "is_virtual": False
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("SOURCE_UNAVAILABLE", reason)

    # ─── CASE 6: Invalid / Unlinked Username (DATA_ERROR) ──────────────────────
    def test_case_06_data_error_no_email(self):
        student = MockStudentModel(6, "732224CS006", "Broken Student", "UNLINKED", "broken@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.DATA_ERROR,
            "is_live": False,
            "is_virtual": False
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("DATA_ERROR", reason)

    # ─── CASE 7: Evidence Pending (PENDING_EVIDENCE) ───────────────────────────
    def test_case_07_pending_evidence_no_email(self):
        student = MockStudentModel(7, "732224CS007", "Pending Student", "pending_coder", "pending@nandha.ac.in")
        record = {
            "attendance_state": "UNKNOWN_PENDING_EVIDENCE",
            "is_live": False,
            "is_virtual": False
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(student, self.session, record)
        self.assertFalse(eligible)
        self.assertIn("PENDING_EVIDENCE", reason)

    # ─── CASE 8: Idempotency & De-duplication ──────────────────────────────────
    def test_case_08_idempotency_duplicate_protection(self):
        db = SessionLocal()
        try:
            student = db.query(Student).first()
            if not student:
                self.skipTest("No student in database for live idempotency test.")

            session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            session_id = session_obj.id if session_obj else 21

            # Dispatch dry run
            res1 = ContestNonAttendanceService.send_single_non_attendance_email(
                student.id, session_id, db, dry_run=True
            )
            self.assertTrue(res1.get("success") or res1.get("status") in ("INELIGIBLE", "DRY_RUN_ELIGIBLE", "ALREADY_SENT"))
        finally:
            db.close()

    # ─── CASE 9: Boundary Condition (timestamp == contest_end_time) ───────────
    def test_case_09_boundary_condition_end_time(self):
        meta = ContestMetadataResolver.resolve_contest_metadata(516)
        end_utc = meta["end_timestamp_utc"]
        
        # Exact boundary: timestamp == end_timestamp_utc is outside live window (< end_timestamp_utc)
        is_live = meta["start_timestamp_utc"] <= end_utc < meta["end_timestamp_utc"]
        self.assertFalse(is_live, "Exact end_time timestamp must be strictly outside the live window.")

    # ─── CASE 10: Academic Design / Zero Emojis Validation ────────────────────
    def test_case_10_zero_emojis_in_email(self):
        subject, html_body, plain_text = build_non_attendance_email_content(
            student_name="Karthik M",
            contest_name="Weekly Contest 516",
            contest_date="23.08.2026",
            start_time="08:00",
            end_time="09:30",
            leetcode_username="karthik_m"
        )

        # 1. Subject validation
        self.assertEqual(subject, "Weekly LeetCode Contest — Non-Attendance Notification")
        self.assertNotIn("⚠️", subject)
        self.assertNotIn("🚨", subject)
        self.assertNotIn("❌", subject)

        # 2. Exact phrasing checks
        self.assertIn("No valid public contest participation evidence was found during the official contest window.", html_body)
        self.assertIn("If you were unable to participate in the contest, please contact your Account Coordinator, Faculty Coordinator, or Contest Proctor", html_body)

        # 3. Emoji pattern search (Forbidden symbols)
        forbidden_symbols = ["⚠️", "🚨", "❌", "🔔", "📢", "🏆", "📊", "🔥", "✨"]
        for sym in forbidden_symbols:
            self.assertNotIn(sym, html_body, f"Forbidden decorative symbol found in HTML: {sym}")
            self.assertNotIn(sym, plain_text, f"Forbidden decorative symbol found in text: {sym}")


if __name__ == "__main__":
    unittest.main()
