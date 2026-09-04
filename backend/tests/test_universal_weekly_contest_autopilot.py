"""
test_universal_weekly_contest_autopilot.py
===========================================
Comprehensive automated unit suite validating the complete autonomous weekly contest lifecycle.
"""

import unittest
import os
from backend.database import SessionLocal
from backend.services.sunday_autopilot import weekly_contest_autopilot


class TestUniversalWeeklyContestAutopilot(unittest.TestCase):

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_discovery_and_preparation(self):
        """Phase 1: Automatic discovery and roster verification"""
        res = weekly_contest_autopilot.phase_1_discovery_and_preparation(self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["total_roster"], 1450)
        self.assertIn("Contest", res["contest_name"])

    def test_02_status_overview_and_countdown(self):
        """Autopilot status endpoint: live telemetry and dynamic countdown"""
        status = weekly_contest_autopilot.get_status_overview(self.db)
        self.assertTrue(status["is_enabled"])
        self.assertIn("next_contest", status)
        self.assertIn("countdown_formatted", status["next_contest"])
        self.assertIn("health_status", status)
        self.assertEqual(status["health_status"], "🟢 HEALTHY")

    def test_03_start_live_monitoring(self):
        """Phase 2: Start live monitoring mode"""
        res = weekly_contest_autopilot.phase_2_start_live_monitoring(21, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "LIVE")

    def test_04_live_monitoring_cycle(self):
        """Phase 3: Rate-limit aware solve monitoring cycle"""
        res = weekly_contest_autopilot.phase_3_live_monitoring_cycle(21, self.db)
        self.assertTrue(res["success"])
        self.assertGreaterEqual(res["live_attended"], 760)

    def test_05_finalization_and_reconciliation(self):
        """Phase 4: Finalize contest and run 1,450 student reconciliation"""
        res = weekly_contest_autopilot.phase_4_finalization_and_reconciliation(21, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "FINALIZED")
        self.assertTrue(res["audit"]["reconciliation_passed"])
        self.assertEqual(res["audit"]["total_roster"], 1450)

    def test_06_multi_format_report_generation(self):
        """Phase 5: Generate Excel, PDF, Word, and ZIP package directly from canonical dataset"""
        res = weekly_contest_autopilot.phase_5_report_generation(21, self.db)
        self.assertTrue(res["success"])
        self.assertTrue(os.path.exists(res["excel_path"]))
        self.assertTrue(os.path.exists(res["pdf_path"]))
        self.assertTrue(os.path.exists(res["word_path"]))
        self.assertTrue(os.path.exists(res["zip_path"]))

    def test_07_virtual_recheck(self):
        """Phase 7: Virtual recheck idempotency"""
        res = weekly_contest_autopilot.phase_7_virtual_recheck(21, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["virtual_attended"], 0)

    def test_08_prepare_next_contest(self):
        """Phase 8: Continuous loop — automatically schedules next weekly contest"""
        res = weekly_contest_autopilot.phase_8_prepare_next_contest(self.db)
        self.assertTrue(res["success"])
        self.assertIn("Contest", res["contest_name"])


if __name__ == "__main__":
    unittest.main()
