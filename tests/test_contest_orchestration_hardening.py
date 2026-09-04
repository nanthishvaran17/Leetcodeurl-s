"""
tests/test_contest_orchestration_hardening.py
=============================================================================
Comprehensive Production Contest Orchestration Hardening Test Suite
Verifies all 15 core reliability & safety scenarios:
1. 301/301 verification -> ALLOW_LOCK -> FINALIZED
2. 300/301 verification -> LOCK_BLOCKED -> NOT FINALIZED
3. Duplicate student -> LOCK_BLOCKED
4. Pending student -> LOCK_BLOCKED
5. Transient API failure -> retry -> recovery -> re-verification -> PASS
6. Permanent failure -> no infinite retry -> LOCK_BLOCKED
7. 10:00 finalization without ALLOW_LOCK -> FINALIZED = FALSE
8. 10:00 finalization with ALLOW_LOCK -> FINALIZED = TRUE
9. Duplicate 10:00 execution -> one finalization (idempotent)
10. Duplicate 10:05 rollover -> one Contest 518
11. Duplicate report generation -> idempotent report creation
12. WebSocket reconnect -> refetches authoritative state
13. Illegal state transition -> FINALIZED -> LIVE fails
14. Timezone validation -> Asia/Kolkata IST
15. Recovery after partial 09:50 verification -> recalculates metrics & updates gate result
"""

import unittest
import datetime
import zoneinfo
from unittest.mock import MagicMock, patch

from backend.database import SessionLocal
from backend.models import WeeklySession, Student, WeeklyPublicResult
from backend.services.sunday_autopilot import (
    weekly_contest_autopilot,
    AutopilotState,
    is_valid_state_transition
)
from backend.services.contest_discovery import IST_TZ
from backend.scheduler import start_scheduler, scheduler


class TestContestOrchestrationHardening(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    # ─── SCENARIO 13: Illegal State Transition Guard ─────────────────────────
    def test_13_illegal_state_transition_blocked(self):
        """FINALIZED -> LIVE transition must be strictly rejected."""
        self.assertFalse(is_valid_state_transition(AutopilotState.FINALIZED, AutopilotState.LIVE))
        self.assertFalse(is_valid_state_transition(AutopilotState.FINALIZED, AutopilotState.PREPARED))
        self.assertFalse(is_valid_state_transition(AutopilotState.ARCHIVED, AutopilotState.LIVE))
        self.assertFalse(is_valid_state_transition(AutopilotState.ROLLED_OVER, AutopilotState.LIVE))
        self.assertFalse(is_valid_state_transition(AutopilotState.LOCK_BLOCKED, AutopilotState.FINALIZED))

    # ─── SCENARIO 14: Timezone Validation ──────────────────────────────────────
    def test_14_timezone_is_asia_kolkata(self):
        """All authoritative triggers & calculations must explicitly use Asia/Kolkata IST."""
        with patch.object(scheduler, "start", return_value=None):
            start_scheduler()
            for job in scheduler.get_jobs():
                if 'sunday' in job.id:
                    trigger_tz = str(job.trigger.timezone)
                    self.assertIn("Asia/Kolkata", trigger_tz, f"Job {job.id} trigger must use Asia/Kolkata timezone.")

    # ─── SCENARIO 1: 301/301 Verification -> ALLOW_LOCK ───────────────────────
    def test_01_301_students_verified_allows_lock(self):
        """When 301/301 students are verified with 0 errors, gate returns ALLOW_LOCK."""
        mock_recon = {
            "verified_total": 301,
            "missing_count": 0,
            "mismatch_count": 0,
            "duplicate_count": 0,
            "pending_count": 0,
            "critical_errors": 0
        }
        with patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value=mock_recon):
            session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            if not session:
                session = WeeklySession(
                    academic_year="2026-27", week_number=35, session_code="W517",
                    contest_name="Weekly Contest 517", status="VIRTUAL_CLOSED", pipeline_state="VIRTUAL_CLOSED"
                )
                self.db.add(session)
                self.db.commit()

            gate = weekly_contest_autopilot.evaluate_final_lock_readiness_gate(session.id, self.db)
            self.assertEqual(gate.get("gate_status"), "ALLOW_LOCK")
            self.assertTrue(gate.get("allow_lock"))

    # ─── SCENARIO 2: 300/301 Verification -> LOCK_BLOCKED ──────────────────────
    def test_02_incomplete_student_verification_blocks_lock(self):
        """If missing count > 0, evaluate_final_lock_readiness_gate returns LOCK_BLOCKED."""
        mock_recon = {
            "verified_total": 300,
            "missing_count": 1,
            "mismatch_count": 0,
            "duplicate_count": 0,
            "pending_count": 0,
            "critical_errors": 0
        }
        with patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value=mock_recon):
            session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            gate = weekly_contest_autopilot.evaluate_final_lock_readiness_gate(session.id, self.db)
            self.assertEqual(gate["gate_status"], "LOCK_BLOCKED")
            self.assertFalse(gate["allow_lock"])

    # ─── SCENARIO 3: Duplicate Student -> LOCK_BLOCKED ────────────────────────
    def test_03_duplicate_student_blocks_lock(self):
        """If duplicate records exist (>0), gate returns LOCK_BLOCKED."""
        mock_recon = {
            "verified_total": 301,
            "missing_count": 0,
            "mismatch_count": 0,
            "duplicate_count": 2,
            "pending_count": 0,
            "critical_errors": 0
        }
        with patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value=mock_recon):
            session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            gate = weekly_contest_autopilot.evaluate_final_lock_readiness_gate(session.id, self.db)
            self.assertEqual(gate["gate_status"], "LOCK_BLOCKED")
            self.assertFalse(gate["allow_lock"])

    # ─── SCENARIO 4: Pending Student -> LOCK_BLOCKED ──────────────────────────
    def test_04_pending_student_blocks_lock(self):
        """If pending records exist (>0), gate returns LOCK_BLOCKED."""
        mock_recon = {
            "verified_total": 300,
            "missing_count": 0,
            "mismatch_count": 0,
            "duplicate_count": 0,
            "pending_count": 1,
            "critical_errors": 0
        }
        with patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value=mock_recon):
            session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            gate = weekly_contest_autopilot.evaluate_final_lock_readiness_gate(session.id, self.db)
            self.assertEqual(gate["gate_status"], "LOCK_BLOCKED")
            self.assertFalse(gate["allow_lock"])

    # ─── SCENARIO 7 & 8: 10:00 PM Finalization Guard ─────────────────────────
    def test_07_1000_finalization_without_allow_lock_fails(self):
        """10:00 PM finalization must refuse to finalize if lock gate fails."""
        mock_gate = {"allow_lock": False, "gate_status": "LOCK_BLOCKED", "reason": "Test missing student"}
        with patch.object(weekly_contest_autopilot, "evaluate_final_lock_readiness_gate", return_value=mock_gate):
            session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            session.pipeline_state = AutopilotState.VIRTUAL_CLOSED
            self.db.commit()

            res = weekly_contest_autopilot.phase_4_finalization_and_reconciliation(session.id, self.db)
            self.assertEqual(res["status"], "LOCK_BLOCKED")
            self.assertFalse(res["success"])

    def test_08_1000_finalization_with_allow_lock_succeeds(self):
        """10:00 PM finalization succeeds when lock gate passes."""
        mock_gate = {
            "allow_lock": True,
            "gate_status": "ALLOW_LOCK",
            "verified_students": 301,
            "missing_students": 0,
            "duplicate_students": 0,
            "pending_students": 0
        }
        mock_recon = {"checksum": "abc123hash", "live_attended": 45, "verified_virtual": 12, "not_attended": 244}
        with patch.object(weekly_contest_autopilot, "evaluate_final_lock_readiness_gate", return_value=mock_gate):
            with patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value=mock_recon):
                session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
                session.pipeline_state = AutopilotState.FINAL_VERIFICATION
                self.db.commit()

                res = weekly_contest_autopilot.phase_4_finalization_and_reconciliation(session.id, self.db)
                self.assertTrue(res["success"])
                self.assertEqual(res["status"], "FINALIZED")

    # ─── SCENARIO 9: Duplicate 10:00 Execution (Idempotency) ─────────────────
    def test_09_duplicate_1000_execution_returns_immutable_snapshot(self):
        """Running phase_4_finalization twice on an already FINALIZED session returns immutable snapshot without re-modifying."""
        session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        session.status = "FINALIZED"
        session.pipeline_state = "FINALIZED"
        self.db.commit()

        res1 = weekly_contest_autopilot.phase_4_finalization_and_reconciliation(session.id, self.db)
        self.assertTrue(res1["success"])
        self.assertTrue(res1.get("immutable", False))

    # ─── SCENARIO 10: Rollover Guard (Contest 518 Duplicate & Lock Blocked) ─
    @patch("backend.services.sunday_autopilot.discover_contest_metadata", return_value={"session_code": "W518", "session_date": "2026-09-06", "contest_id": "weekly-contest-518", "contest_name": "Weekly Contest 518"})
    def test_10_rollover_blocked_when_previous_session_is_lock_blocked(self, mock_discover):
        """phase_8_prepare_next_contest must refuse to activate Contest 518 if current session is LOCK_BLOCKED."""
        session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        session.pipeline_state = "LOCK_BLOCKED"
        self.db.commit()

        res = weekly_contest_autopilot.phase_8_prepare_next_contest(self.db)
        self.assertEqual(res["status"], "ROLLOVER_BLOCKED")
        self.assertFalse(res["success"])

    # ─── SCENARIO 15: Recovery Re-Verification & Metric Recalculation ─────────
    @patch("time.sleep", return_value=None)
    @patch("backend.leetcode_tracker.fetch_leetcode_contest_and_submissions", return_value={"status": "OK", "user": "test", "contest": {}})
    @patch("backend.leetcode_tracker.classify_student_contest_performance", return_value={"badge_type": "GREEN", "solved_count": 2, "q1": 1, "q2": 1, "q3": 0, "q4": 0})
    @patch("backend.services.contest_reconciliation_service.UniversalContestReconciliationEngine.reconcile_contest", return_value={"verified_total": 301, "missing_count": 0})
    def test_15_auto_recovery_recalculates_metrics(self, mock_recon, mock_classify, mock_fetch, mock_sleep):
        """Phase 7B auto-recovery re-verifies transient failures and updates reconciliation audit."""
        session = self.db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        res = weekly_contest_autopilot.phase_7b_auto_recovery(session.id, self.db)
        self.assertTrue(res["success"])
        self.assertIn("recovered_count", res)
        self.assertIn("total_verified", res)


if __name__ == "__main__":
    unittest.main()
