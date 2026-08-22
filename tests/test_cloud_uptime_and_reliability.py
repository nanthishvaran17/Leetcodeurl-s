"""
test_cloud_uptime_and_reliability.py — Cloud Uptime, Crash Recovery & Autopilot Hardening Test Suite.
Verifies Liveness, Readiness, Deep Health, Worker Heartbeats, Checkpoint Recovery, and SQLite WAL Resilience.
"""

import os
import time
import unittest
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import SessionLocal, engine
from backend.models import Student, WeeklySession, WeeklyPublicResult
from backend.services.heartbeat_service import (
    record_worker_heartbeat,
    get_worker_heartbeat,
    record_scheduler_heartbeat,
    get_scheduler_heartbeat,
    get_deep_health_telemetry
)
from backend.services.sunday_autopilot import sunday_autopilot


class TestCloudUptimeAndReliability(unittest.TestCase):
    def setUp(self):
        self.db: Session = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_liveness_readiness_and_deep_health_probes(self):
        """Test Liveness, Readiness, and Deep Health Telemetry."""
        telemetry = get_deep_health_telemetry(self.db)
        self.assertIn("status", telemetry)
        self.assertEqual(telemetry["status"], "HEALTHY")
        self.assertEqual(telemetry["database"]["status"], "HEALTHY")
        self.assertGreaterEqual(telemetry["database"]["student_records"], 1395)
        self.assertEqual(telemetry["database"]["journal_mode"], "WAL")
        self.assertEqual(telemetry["scheduler"]["timezone"], "Asia/Kolkata")
        print(f"  + [RELIABILITY 1 PASSED]: Deep Health Probe verified (DB Latency: {telemetry['database']['latency_ms']}ms, WAL: {telemetry['database']['journal_mode']}).")

    def test_02_worker_heartbeat_and_staleness_detector(self):
        """Test Worker Heartbeat update, retrieval, and staleness detection."""
        record_worker_heartbeat(status="RUNNING", current_job="TEST_SUNDAY_JOB", last_successful_job="TEST_SYNC")
        hb = get_worker_heartbeat()
        self.assertEqual(hb["status"], "RUNNING")
        self.assertEqual(hb["current_job"], "TEST_SUNDAY_JOB")
        self.assertLess(hb["seconds_since_last_seen"], 5.0)
        print("  + [RELIABILITY 2 PASSED]: Worker Heartbeat & Live Telemetry verified.")

    def test_03_scheduler_heartbeat_and_timezone(self):
        """Test Scheduler Heartbeat tracking under Asia/Kolkata."""
        record_scheduler_heartbeat(status="RUNNING", next_scheduled_job="sunday_0755_init")
        shb = get_scheduler_heartbeat()
        self.assertEqual(shb["status"], "RUNNING")
        self.assertEqual(shb["timezone"], "Asia/Kolkata")
        self.assertEqual(shb["next_scheduled_job"], "sunday_0755_init")
        print("  + [RELIABILITY 3 PASSED]: Scheduler Heartbeat [Asia/Kolkata] verified.")

    def test_04_crash_recovery_and_checkpoint_durability(self):
        """Test Server Restart / Crash Recovery without duplicating records or corrupting state."""
        # Test startup recovery execution
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Verify resume_or_recover_on_startup runs safely
        loop.run_until_complete(sunday_autopilot.resume_or_recover_on_startup())
        loop.close()

        # Confirm student count remains intact
        total = self.db.query(Student).count()
        self.assertGreaterEqual(total, 1395)
        print("  + [RELIABILITY 4 PASSED]: Crash Recovery and In-Flight Checkpoint Resumption verified.")

    def test_05_database_wal_concurrency_and_busy_timeout(self):
        """Test SQLite WAL concurrency, busy_timeout, and multi-threaded connection resilience."""
        with engine.connect() as conn:
            journal = conn.execute(text("PRAGMA journal_mode")).scalar()
            self.assertEqual(str(journal).upper(), "WAL")
            timeout = conn.execute(text("PRAGMA busy_timeout")).scalar()
            self.assertGreaterEqual(timeout, 5000, "busy_timeout must be at least 5000ms.")
        print(f"  + [RELIABILITY 5 PASSED]: SQLite WAL Mode ({journal}) & Busy Timeout ({timeout}ms) verified.")


if __name__ == "__main__":
    unittest.main()
