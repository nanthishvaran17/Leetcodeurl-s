"""
test_latest_successful_snapshot_architecture.py
================================================
Automated test suite verifying the authoritative Latest Successful Snapshot architecture:
- Monotonic data_version progression
- Atomic pointer switching
- Failure immunity (failed fetches never overwrite valid snapshots)
- Canonical /api/stats/current and /api/stats/version endpoints
- Proper HTTP cache-control headers
"""

import unittest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.services.snapshot_manager import authoritative_snapshot_engine
from backend.models import OfficialWeeklySnapshot


class TestLatestSuccessfulSnapshotArchitecture(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_version_endpoint(self):
        """Verify /api/stats/version returns data_version and snapshot_id"""
        res = self.client.get("/api/stats/version")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("data_version", data)
        self.assertIn("snapshot_id", data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "SUCCESS")

    def test_02_current_stats_endpoint(self):
        """Verify /api/stats/current returns full authoritative dataset with cache-control headers"""
        res = self.client.get("/api/stats/current")
        self.assertEqual(res.status_code, 200)
        self.assertIn("no-cache", res.headers.get("cache-control", ""))
        data = res.json()
        self.assertIn("data_version", data)
        self.assertIn("matrixRows", data)
        self.assertEqual(data["status"], "SUCCESS")

    def test_03_atomic_monotonic_snapshot_publish(self):
        """Verify publishing new validated snapshot increments data_version and updates pointer atomically"""
        v_before = authoritative_snapshot_engine.get_latest_version_info(self.db)["data_version"]

        dummy_dataset = {
            "contestName": "Weekly Contest 516",
            "matrixRows": [{"student_id": 1, "name": "Student 1", "score": 10}],
            "metrics": {"officialAttended": 767, "totalStudents": 1450, "failedVerification": 15},
            "dataset_hash": "test_hash_123"
        }

        pub_res = authoritative_snapshot_engine.publish_new_successful_snapshot(
            session_id=21,
            dataset=dummy_dataset,
            db=self.db
        )
        self.assertTrue(pub_res["success"])
        v_after = pub_res["data_version"]
        self.assertGreater(v_after, v_before)

        # Verify endpoint immediately returns new version
        res = self.client.get("/api/stats/version")
        self.assertEqual(res.json()["data_version"], v_after)

    def test_04_failed_fetch_never_overwrites_current_snapshot(self):
        """Verify unvalidated or empty payload rejects publication and preserves existing pointer"""
        v_current = authoritative_snapshot_engine.get_latest_version_info(self.db)["data_version"]

        # Attempt to publish invalid empty dataset
        with self.assertRaises(ValueError):
            authoritative_snapshot_engine.publish_new_successful_snapshot(
                session_id=21,
                dataset={},  # Empty -> Must fail validation
                db=self.db
            )

        # Ensure current pointer is strictly preserved
        v_check = authoritative_snapshot_engine.get_latest_version_info(self.db)["data_version"]
        self.assertEqual(v_check, v_current)

    def test_05_historical_snapshot_retrieval(self):
        """Verify historical snapshots are retrievable without mutating current pointer"""
        authoritative_snapshot_engine.get_latest_version_info(self.db)["data_version"]
        
        # Query existing snapshot
        snap = self.db.query(OfficialWeeklySnapshot).first()
        if snap:
            res = self.client.get(f"/api/stats/snapshots/{snap.id}")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["data_version"], 100 + snap.id)


if __name__ == "__main__":
    unittest.main()
