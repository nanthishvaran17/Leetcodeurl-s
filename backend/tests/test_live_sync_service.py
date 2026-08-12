import unittest
import asyncio
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, LeetCodeProfileStats, SyncJob, SyncJobItem, Department
from backend.services.live_sync_service import (
    start_full_sync_job,
    _process_single_student_sync,
    sync_single_student,
    get_system_freshness
)

class TestLiveSyncService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()
        # Seed test department & students
        dept = Department(name="Computer Science & Cyber Security", code="CSE(CS)")
        self.db.add(dept)
        self.db.commit()
        self.db.refresh(dept)

        s1 = Student(reg_no="TEST732201", name="Test Student Alpha", department_id=dept.id, year_level="III", username="alpha_user", is_active=True)
        s2 = Student(reg_no="TEST732202", name="Test Student Beta", department_id=dept.id, year_level="III", username="beta_user", is_active=True)
        self.db.add_all([s1, s2])
        self.db.commit()

        st1 = LeetCodeProfileStats(student_id=s1.id, total_solved=707, easy_solved=320, medium_solved=250, hard_solved=137, contest_rating=1650.0, status="verified", sync_status="success")
        st2 = LeetCodeProfileStats(student_id=s2.id, total_solved=500, easy_solved=200, medium_solved=200, hard_solved=100, contest_rating=1500.0, status="verified", sync_status="success")
        self.db.add_all([st1, st2])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)

    def test_db_level_single_job_lock(self):
        """Verifies that launching a sync when a job is RUNNING returns the active job_id."""
        job1 = start_full_sync_job(self.db, triggered_by="admin")
        self.assertIn("job_id", job1)
        self.assertEqual(job1["status"], "RUNNING")

        # Second trigger should reuse existing RUNNING job
        job2 = start_full_sync_job(self.db, triggered_by="admin")
        self.assertEqual(job1["job_id"], job2["job_id"])
        self.assertEqual(job2["status"], "RUNNING")

    def test_error_preserves_previous_valid_data(self):
        """Verifies that when a fetch fails, previous valid total/easy/medium/hard are retained with LAST_VERIFIED status."""
        student = self.db.query(Student).filter(Student.reg_no == "TEST732201").first()
        self.assertIsNotNone(student)

        # Simulate fetch failure (exception or error dict)
        err_res = {"status": "error", "error_message": "Network timeout", "error_code": "NETWORK_TIMEOUT"}
        is_succ, is_partial, is_err = _process_single_student_sync(self.db, "JOB-TEST-001", student, err_res)

        self.assertFalse(is_succ)
        self.assertTrue(is_partial) # Retained previous valid values
        self.assertFalse(is_err)

        # Verify values preserved
        self.db.refresh(student.stats)
        self.assertEqual(student.stats.total_solved, 707)
        self.assertEqual(student.stats.easy_solved, 320)
        self.assertEqual(student.stats.medium_solved, 250)
        self.assertEqual(student.stats.hard_solved, 137)
        self.assertEqual(student.stats.sync_status, "stale")

        # Verify audit item status is LAST_VERIFIED
        item = self.db.query(SyncJobItem).filter(SyncJobItem.job_id == "JOB-TEST-001").first()
        self.assertIsNotNone(item)
        self.assertEqual(item.status, "LAST_VERIFIED")
        self.assertEqual(item.old_value, "707")

    def test_successful_sync_updates_and_computes_derived_total(self):
        """Verifies successful profile sync updates values and calculates derived total."""
        student = self.db.query(Student).filter(Student.reg_no == "TEST732201").first()

        success_res = {
            "status": "verified",
            "total_solved": 725,
            "easy_solved": 325,
            "medium_solved": 253,
            "hard_solved": 147,
            "contest_rating": 1680.0,
            "contest_global_ranking": 25000
        }
        is_succ, is_partial, is_err = _process_single_student_sync(self.db, "JOB-TEST-002", student, success_res)

        self.assertTrue(is_succ)
        self.assertFalse(is_partial)
        self.assertFalse(is_err)

        self.db.refresh(student.stats)
        self.assertEqual(student.stats.total_solved, 725)
        self.assertEqual(student.stats.derived_total_solved, 725)
        self.assertEqual(student.stats.source_total_solved, 725)
        self.assertEqual(student.stats.easy_solved, 325)
        self.assertEqual(student.stats.medium_solved, 253)
        self.assertEqual(student.stats.hard_solved, 147)
        self.assertEqual(student.stats.sync_status, "success")

    def test_get_system_freshness(self):
        """Verifies get_system_freshness returns correct summary and badges."""
        freshness = get_system_freshness(self.db)
        self.assertEqual(freshness["total_students"], 2)
        self.assertEqual(freshness["verified_count"], 2)
        self.assertIn("Freshness Badge", freshness.get("freshness_badge", ""))

if __name__ == "__main__":
    unittest.main()
