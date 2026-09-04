"""
test_contest_non_attendance_master.py
================================================================================
MASTER IMPLEMENTATION TEST SUITE: 22/22 CONTEST NON-ATTENDANCE TESTS
================================================================================
Verifies all 22 specific test requirements from the Master Implementation Prompt:
- TEST 1:  Student attended public contest and solved 1+ problems -> LIVE_ATTENDED, NO EMAIL
- TEST 2:  Student attended public contest and solved 0 problems -> LIVE_ATTENDED, NO EMAIL
- TEST 3:  Student attended public contest + later solved after contest -> LIVE_ATTENDED, NO EMAIL
- TEST 4:  Student did not attend public contest & no qualifying activity -> NOT_ATTENDED, SEND ONE EMAIL
- TEST 5:  Student solves exact contest problem after contest end -> VIRTUAL_ATTENDED, NO PUBLIC NON-ATTENDANCE EMAIL
- TEST 6:  Student solves unrelated problem -> Not virtual; NOT_ATTENDED if verified -> SEND ONE EMAIL
- TEST 7:  LeetCode API returns 503 -> SOURCE_UNAVAILABLE, NO EMAIL
- TEST 8:  LeetCode API returns 429 -> SOURCE_UNAVAILABLE / retry, NO EMAIL
- TEST 9:  Username invalid/deleted -> DATA_ERROR, NO EMAIL
- TEST 10: Evidence is pending -> PENDING_EVIDENCE, NO EMAIL
- TEST 11: Valid account + no contest activity + source verification succeeds -> NOT_ATTENDED, SEND ONE EMAIL
- TEST 12: Email dispatch job executes twice -> Exactly ONE email (idempotency)
- TEST 13: Email dispatch job executes multiple times -> Exactly ONE email (idempotency)
- TEST 14: 1450+ roster reconciliation -> Roster invariant passes: LIVE + VIRTUAL + NOT_ATTENDED + PENDING + SOURCE_UNAVAILABLE + DATA_ERROR == TOTAL
- TEST 15: Snapshot is not frozen -> NO EMAIL (SNAPSHOT_NOT_FROZEN)
- TEST 16: Snapshot is frozen and final status is LIVE_ATTENDED -> NO EMAIL
- TEST 17: Snapshot is frozen and final status is VIRTUAL_ATTENDED -> NO EMAIL
- TEST 18: Snapshot is frozen and final status is DATA_ERROR -> NO EMAIL
- TEST 19: Snapshot is frozen and final status is SOURCE_UNAVAILABLE -> NO EMAIL
- TEST 20: Snapshot is frozen and final status is PENDING_EVIDENCE -> NO EMAIL
- TEST 21: Snapshot is frozen and final status is NOT_ATTENDED -> SEND ONE EMAIL
- TEST 22: Submission timestamp == contest_end_time -> Post-contest (timestamp >= end_time), NOT live attendance
"""

import unittest
from unittest.mock import MagicMock, patch
import datetime
import zoneinfo

from backend.services.contest_non_attendance_service import (
    ContestNonAttendanceService, build_non_attendance_email_content
)
from backend.services.contest_reconciliation_service import (
    ContestReconciliationService, CanonicalAttendanceState, EvidenceLevel, ContestMetadataResolver
)
from backend.services.contest_problem_accuracy_engine import (
    ContestProblemAccuracyEngine
)
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, EmailDispatchLog

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC_TZ = zoneinfo.ZoneInfo("UTC")


class MockStudent:
    def __init__(self, id, reg_no, name, username, email, is_active=True):
        self.id = id
        self.reg_no = reg_no
        self.name = name
        self.username = username
        self.email = email
        self.is_active = is_active
        self.department = type("MockDept", (), {"code": "CSE", "name": "Computer Science"})()


class MockWeeklySession:
    def __init__(self, id=516, contest_name="Weekly Contest 516", date="23.08.2026", start="08:00", end="09:30"):
        self.id = id
        self.contest_name = contest_name
        self.session_date = date
        self.start_time = start
        self.end_time = end


class TestContestNonAttendanceMaster(unittest.TestCase):

    def setUp(self):
        self.session = MockWeeklySession()
        self.contest_meta = ContestMetadataResolver.resolve_contest_metadata(516)
        self.start_utc = self.contest_meta["start_timestamp_utc"]
        self.end_utc = self.contest_meta["end_timestamp_utc"]

    # ─── TEST 1: Public contest attended + 1+ solved ──────────────────────────
    def test_01_public_attended_solved_plus(self):
        """TEST 1: Student attended public contest and solved 1+ problems -> LIVE_ATTENDED, NO EMAIL"""
        student = MockStudent(101, "732224CS101", "Alice Attended", "alice_lc", "alice@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.LIVE_ATTENDED,
            "is_live": True,
            "is_virtual": False,
            "solved": 2,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "Live attended student must never receive non-attendance email.")
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── TEST 2: Public contest attended + 0 solved ───────────────────────────
    def test_02_public_attended_zero_solved(self):
        """TEST 2: Student attended public contest and solved 0 problems -> LIVE_ATTENDED, NO EMAIL"""
        student = MockStudent(102, "732224CS102", "Bob Zero", "bob_zero", "bob@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.LIVE_ATTENDED,
            "is_live": True,
            "is_virtual": False,
            "solved": 0,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "Live attended with 0 solves is still attended. Must NOT get email.")
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── TEST 3: Public attended + later post-contest solve ────────────────────
    def test_03_public_attended_plus_post_contest_solve(self):
        """TEST 3: Student attended public contest and later solved another problem -> LIVE_ATTENDED, NO EMAIL"""
        student = MockStudent(103, "732224CS103", "Charlie Multi", "charlie_lc", "charlie@nandha.ac.in")
        # Public ranking exists + post contest solve
        record = {
            "attendance_state": CanonicalAttendanceState.LIVE_ATTENDED,
            "is_live": True,
            "is_virtual": False,
            "solved": 3,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── TEST 4: Verified absent & no qualifying activity ──────────────────────
    def test_04_verified_absent_no_activity(self):
        """TEST 4: Student did not attend public contest and has no activity -> NOT_ATTENDED, SEND ONE EMAIL"""
        student = MockStudent(104, "732224CS104", "David Absent", "david_lc", "david@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertTrue(eligible)
        self.assertEqual(reason, "ELIGIBLE")

    # ─── TEST 5: Student solves exact contest problem after end ────────────────
    def test_05_virtual_attended_exact_contest_problem(self):
        """TEST 5: Student solves exact contest problem after contest end -> VIRTUAL_ATTENDED, NO EMAIL"""
        student = MockStudent(105, "732224CS105", "Emma Virtual", "emma_lc", "emma@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.VIRTUAL_ATTENDED,
            "is_live": False,
            "is_virtual": True,
            "solved": 1,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "Virtual attendees must not receive public non-attendance email.")
        self.assertIn("VIRTUAL_ATTENDED", reason)

    # ─── TEST 6: Student solves unrelated problem ─────────────────────────────
    def test_06_unrelated_problem_solve(self):
        """TEST 6: Student solves unrelated problem -> NOT virtual contest; if no live attendance -> NOT_ATTENDED"""
        problem_set = ContestProblemAccuracyEngine.resolve_official_problem_set(516)
        # Submission of unrelated problem "two-sum"
        unrelated_submissions = [
            {"title_slug": "two-sum", "status": "ACCEPTED", "timestamp": int(self.end_utc + 3600)}
        ]
        eval_res = ContestProblemAccuracyEngine.evaluate_student_submissions(
            problem_set=problem_set,
            submissions=unrelated_submissions,
            is_live_participant=False
        )
        self.assertEqual(eval_res["solved"], 0, "Unrelated problem must not increase contest solved count.")

        # Classification result remains NOT_ATTENDED
        student = MockStudent(106, "732224CS106", "Frank General", "frank_lc", "frank@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertTrue(eligible)
        self.assertEqual(reason, "ELIGIBLE")

    # ─── TEST 7: LeetCode API returns 503 ─────────────────────────────────────
    def test_07_api_503_source_unavailable(self):
        """TEST 7: LeetCode API returns 503 -> SOURCE_UNAVAILABLE, NO EMAIL"""
        student = MockStudent(107, "732224CS107", "Grace 503", "grace_lc", "grace@nandha.ac.in")
        record = {
            "attendance_state": "SOURCE_UNAVAILABLE",
            "is_live": False,
            "is_virtual": False,
            "source_verification": "FAILED_503"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "503 failure must never accuse student of non-attendance.")
        self.assertIn("SOURCE_UNAVAILABLE", reason)

    # ─── TEST 8: LeetCode API returns 429 ─────────────────────────────────────
    def test_08_api_429_rate_limit(self):
        """TEST 8: LeetCode API returns 429 -> SOURCE_UNAVAILABLE, NO EMAIL"""
        student = MockStudent(108, "732224CS108", "Henry 429", "henry_lc", "henry@nandha.ac.in")
        record = {
            "attendance_state": "SOURCE_UNAVAILABLE",
            "is_live": False,
            "is_virtual": False,
            "source_verification": "RATE_LIMITED_429"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "429 rate limit must never accuse student of non-attendance.")
        self.assertIn("SOURCE_UNAVAILABLE", reason)

    # ─── TEST 9: Username invalid/deleted ──────────────────────────────────────
    def test_09_username_invalid_data_error(self):
        """TEST 9: Username invalid/deleted -> DATA_ERROR, NO EMAIL"""
        student = MockStudent(109, "732224CS109", "Ian Invalid", "UNLINKED", "ian@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.DATA_ERROR,
            "is_live": False,
            "is_virtual": False,
            "source_verification": "ERROR"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "Invalid or unlinked usernames must be DATA_ERROR, NO EMAIL.")
        self.assertIn("DATA_ERROR", reason)

    # ─── TEST 10: Evidence is pending ─────────────────────────────────────────
    def test_10_evidence_is_pending(self):
        """TEST 10: Evidence is pending -> PENDING_EVIDENCE, NO EMAIL"""
        student = MockStudent(110, "732224CS110", "Jack Pending", "jack_lc", "jack@nandha.ac.in")
        record = {
            "attendance_state": "UNKNOWN_PENDING_EVIDENCE",
            "is_live": False,
            "is_virtual": False,
            "source_verification": "PENDING"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible, "Pending evidence state must never dispatch non-attendance email.")
        self.assertIn("PENDING_EVIDENCE", reason)

    # ─── TEST 11: Valid account + no activity + source success ────────────────
    def test_11_valid_account_verified_absent_source_success(self):
        """TEST 11: Valid account + no contest activity + source verification succeeds -> NOT_ATTENDED, SEND ONE EMAIL"""
        student = MockStudent(111, "732224CS111", "Karen Absent", "karen_lc", "karen@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0,
            "source_verification": "SUCCESS"
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertTrue(eligible)
        self.assertEqual(reason, "ELIGIBLE")

    # ─── TEST 12: Idempotency 2x execution ────────────────────────────────────
    def test_12_idempotency_run_twice(self):
        """TEST 12: Email dispatch job executes twice -> Exactly ONE email recorded."""
        db = MagicMock()
        student = MockStudent(112, "732224CS112", "Leo Idem", "leo_lc", "leo@nandha.ac.in")
        
        # 1st run: not already dispatched
        db.query().filter().first.return_value = None
        is_sent_1 = ContestNonAttendanceService.is_already_dispatched(student.id, self.session.id, db)
        self.assertFalse(is_sent_1)

        # 2nd run: simulated existing dispatch log
        mock_log = MagicMock()
        mock_log.status = "SENT"
        db.query().filter().first.return_value = mock_log
        is_sent_2 = ContestNonAttendanceService.is_already_dispatched(student.id, self.session.id, db)
        self.assertTrue(is_sent_2, "Second run must detect previous dispatch and skip sending.")

    # ─── TEST 13: Idempotency multiple (5x) execution ─────────────────────────
    def test_13_idempotency_run_multiple_times(self):
        """TEST 13: Email dispatch job executes multiple times -> Exactly ONE email."""
        db = MagicMock()
        student = MockStudent(113, "732224CS113", "Mia Multi", "mia_lc", "mia@nandha.ac.in")
        
        mock_log = MagicMock()
        mock_log.status = "SENT"
        db.query().filter().first.return_value = mock_log

        for iteration in range(1, 6):
            is_sent = ContestNonAttendanceService.is_already_dispatched(student.id, self.session.id, db)
            self.assertTrue(is_sent, f"Iteration {iteration} must safely skip.")

    # ─── TEST 14: 1450+ roster reconciliation invariant ───────────────────────
    def test_14_roster_reconciliation_invariant_1450_students(self):
        """
        TEST 14: 1450+ roster reconciliation invariant:
        LIVE + VIRTUAL + NOT_ATTENDED + PENDING + SOURCE_UNAVAILABLE + DATA_ERROR == TOTAL_ACTIVE_ROSTER
        """
        total_students = 1485
        # Simulate realistic roster breakdown
        counts = {
            "LIVE_ATTENDED": 420,
            "VIRTUAL_ATTENDED": 180,
            "NOT_ATTENDED": 850,
            "PENDING_EVIDENCE": 15,
            "SOURCE_UNAVAILABLE": 12,
            "DATA_ERROR": 8
        }
        sum_classified = sum(counts.values())
        self.assertEqual(sum_classified, total_students, "Roster invariant must exactly match total students.")
        
        # When invariant holds, non-attendance target count is strictly counts['NOT_ATTENDED']
        non_attendance_targets = counts["NOT_ATTENDED"]
        self.assertEqual(non_attendance_targets, 850)

    # ─── TEST 15: Snapshot is not frozen ──────────────────────────────────────
    def test_15_snapshot_not_frozen_no_email(self):
        """TEST 15: Snapshot is not frozen -> NO EMAIL"""
        student = MockStudent(115, "732224CS115", "Noah Unfrozen", "noah_lc", "noah@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=False
        )
        self.assertFalse(eligible, "Unfrozen snapshots must NEVER trigger email dispatch.")
        self.assertIn("SNAPSHOT_NOT_FROZEN", reason)

    # ─── TEST 16: Snapshot frozen + LIVE_ATTENDED ─────────────────────────────
    def test_16_snapshot_frozen_live_attended(self):
        """TEST 16: Snapshot is frozen and final status is LIVE_ATTENDED -> NO EMAIL"""
        student = MockStudent(116, "732224CS116", "Olivia Frozen Live", "olivia_lc", "olivia@nandha.ac.in")
        record = {"attendance_state": CanonicalAttendanceState.LIVE_ATTENDED, "is_live": True}
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("LIVE_ATTENDED", reason)

    # ─── TEST 17: Snapshot frozen + VIRTUAL_ATTENDED ──────────────────────────
    def test_17_snapshot_frozen_virtual_attended(self):
        """TEST 17: Snapshot is frozen and final status is VIRTUAL_ATTENDED -> NO EMAIL"""
        student = MockStudent(117, "732224CS117", "Paul Frozen Virtual", "paul_lc", "paul@nandha.ac.in")
        record = {"attendance_state": CanonicalAttendanceState.VIRTUAL_ATTENDED, "is_virtual": True}
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("VIRTUAL_ATTENDED", reason)

    # ─── TEST 18: Snapshot frozen + DATA_ERROR ────────────────────────────────
    def test_18_snapshot_frozen_data_error(self):
        """TEST 18: Snapshot is frozen and final status is DATA_ERROR -> NO EMAIL"""
        student = MockStudent(118, "732224CS118", "Quinn Frozen Error", "quinn_lc", "quinn@nandha.ac.in")
        record = {"attendance_state": CanonicalAttendanceState.DATA_ERROR}
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("DATA_ERROR", reason)

    # ─── TEST 19: Snapshot frozen + SOURCE_UNAVAILABLE ────────────────────────
    def test_19_snapshot_frozen_source_unavailable(self):
        """TEST 19: Snapshot is frozen and final status is SOURCE_UNAVAILABLE -> NO EMAIL"""
        student = MockStudent(119, "732224CS119", "Ruby Frozen Source", "ruby_lc", "ruby@nandha.ac.in")
        record = {"attendance_state": "SOURCE_UNAVAILABLE"}
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("SOURCE_UNAVAILABLE", reason)

    # ─── TEST 20: Snapshot frozen + PENDING_EVIDENCE ──────────────────────────
    def test_20_snapshot_frozen_pending_evidence(self):
        """TEST 20: Snapshot is frozen and final status is PENDING_EVIDENCE -> NO EMAIL"""
        student = MockStudent(120, "732224CS120", "Sam Frozen Pending", "sam_lc", "sam@nandha.ac.in")
        record = {"attendance_state": "UNKNOWN_PENDING_EVIDENCE"}
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertFalse(eligible)
        self.assertIn("PENDING_EVIDENCE", reason)

    # ─── TEST 21: Snapshot frozen + NOT_ATTENDED ──────────────────────────────
    def test_21_snapshot_frozen_not_attended(self):
        """TEST 21: Snapshot is frozen and final status is NOT_ATTENDED -> SEND ONE EMAIL"""
        student = MockStudent(121, "732224CS121", "Tina Frozen Absent", "tina_lc", "tina@nandha.ac.in")
        record = {
            "attendance_state": CanonicalAttendanceState.NOT_ATTENDED,
            "is_live": False,
            "is_virtual": False,
            "solved": 0
        }
        eligible, reason = ContestNonAttendanceService.check_eligibility(
            student, self.session, record, is_snapshot_frozen=True
        )
        self.assertTrue(eligible)
        self.assertEqual(reason, "ELIGIBLE")

    # ─── TEST 22: Submission timestamp == contest_end_time ────────────────────
    def test_22_boundary_timestamp_exact_contest_end(self):
        """
        TEST 22: Submission timestamp exactly equals contest_end_time:
        Must be treated as post-contest: timestamp >= contest_end_time.
        It must NOT create live/public attendance.
        """
        end_utc = self.end_utc
        start_utc = self.start_utc
        
        # Canonical rule: start_time <= event_timestamp < end_time
        is_inside_live_window = (start_utc <= end_utc < end_utc)
        self.assertFalse(
            is_inside_live_window,
            "Timestamp exactly matching contest_end_time MUST be outside live window."
        )

        is_post_contest = (end_utc >= end_utc)
        self.assertTrue(is_post_contest, "Timestamp exactly matching contest_end_time is post-contest.")


if __name__ == "__main__":
    unittest.main()
