import unittest

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, Department
from backend.leetcode_fetcher import extract_leetcode_username
from backend.services.live_sync_service import sync_single_student, _active_single_fetches

class TestLeetCodeURLWorkflow(unittest.TestCase):

    def setUp(self):
        self.db = SessionLocal()
        # Create a test department if not exists
        dept = self.db.query(Department).filter(Department.code == "CSE").first()
        if not dept:
            dept = Department(name="Computer Science and Engineering", code="CSE")
            self.db.add(dept)
            self.db.commit()
            self.db.refresh(dept)
        self.dept_id = dept.id

        # Clean up any test student
        self.db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id.in_(
            self.db.query(Student.id).filter(Student.reg_no.like("TEST_URL_%"))
        )).delete(synchronize_session=False)
        self.db.query(Student).filter(Student.reg_no.like("TEST_URL_%")).delete(synchronize_session=False)
        self.db.commit()

    def tearDown(self):
        self.db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id.in_(
            self.db.query(Student.id).filter(Student.reg_no.like("TEST_URL_%"))
        )).delete(synchronize_session=False)
        self.db.query(Student).filter(Student.reg_no.like("TEST_URL_%")).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def test_1_change_url_and_fetch_new_username(self):
        """Test 1: Change URL -> fetch -> new username appears."""
        student = Student(
            reg_no="TEST_URL_001",
            name="Test Student 1",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/old_user_001/",
            username="old_user_001"
        )
        self.db.add(student)
        self.db.commit()
        self.db.refresh(student)

        stats = LeetCodeProfileStats(student_id=student.id, total_solved=100, sync_status="verified")
        self.db.add(stats)
        self.db.commit()

        # Update URL to new valid user (e.g. bharath_k or valid handle)
        new_url = "https://leetcode.com/u/bharath_k/"
        student.leetcode_url = new_url
        new_u, std_url, status = extract_leetcode_username(new_url)
        self.assertEqual(status, "OK")
        student.username = new_u.lower()
        self.db.commit()

        # Sync single student
        res = sync_single_student(student.id, self.db, force_refresh=True)
        self.db.refresh(student)

        self.assertEqual(student.username, "bharath_k")
        self.assertIn("bharath_k", student.leetcode_url)

    def test_2_change_url_old_username_removed(self):
        """Test 2: Change URL -> fetch -> old username does NOT appear."""
        student = Student(
            reg_no="TEST_URL_002",
            name="Test Student 2",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/old_user_002/",
            username="old_user_002"
        )
        self.db.add(student)
        self.db.commit()

        # Change URL
        student.leetcode_url = "https://leetcode.com/u/nanthish_s/"
        u_new, canonical_url, _ = extract_leetcode_username(student.leetcode_url)
        student.username = u_new.lower()
        student.leetcode_url = canonical_url
        self.db.commit()

        res = sync_single_student(student.id, self.db, force_refresh=True)
        self.db.refresh(student)

        self.assertNotEqual(student.username, "old_user_002")
        self.assertEqual(student.username, "nanthish_s")

    def test_3_invalid_url_fetch_blocked(self):
        """Test 3: Invalid URL -> fetch blocked (URL_INVALID)."""
        student = Student(
            reg_no="TEST_URL_003",
            name="Test Student 3",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://invalid-website.com/not_leetcode",
            username=None
        )
        self.db.add(student)
        self.db.commit()

        res = sync_single_student(student.id, self.db, force_refresh=True)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["sync_status"], "url_invalid")

    def test_4_non_existing_profile_failed_status(self):
        """Test 4: Non-existing profile -> FAILED / PROFILE_NOT_FOUND status."""
        non_exist_handle = "no_exist_profile_xyz_999"
        student = Student(
            reg_no="TEST_URL_004",
            name="Test Student 4",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url=f"https://leetcode.com/u/{non_exist_handle}/",
            username=non_exist_handle
        )
        self.db.add(student)
        self.db.commit()

        res = sync_single_student(student.id, self.db, force_refresh=True)
        self.db.refresh(student)

        self.assertIn(student.stats.sync_status, ["invalid_username", "failed", "404_not_found"])
        self.assertEqual(student.leetcode_url, f"https://leetcode.com/u/{non_exist_handle}/")

    def test_5_valid_url_with_trailing_slash_and_params(self):
        """Test 5: Valid URL with trailing slash & query parameters works."""
        raw_url = "https://leetcode.com/u/bharath_k/?utm_source=test&ref=123#section"
        username, std_url, status = extract_leetcode_username(raw_url)

        self.assertEqual(status, "OK")
        self.assertEqual(username, "bharath_k")
        self.assertEqual(std_url, "https://leetcode.com/u/bharath_k/")

    def test_6_same_url_refetch_performs_fresh_fetch(self):
        """Test 6: Same URL -> re-fetch still performs fresh fetch."""
        student = Student(
            reg_no="TEST_URL_006",
            name="Test Student 6",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/bharath_k/",
            username="bharath_k"
        )
        self.db.add(student)
        self.db.commit()

        res1 = sync_single_student(student.id, self.db, force_refresh=True)
        res2 = sync_single_student(student.id, self.db, force_refresh=True)

        self.assertEqual(res2["status"], "success")

    def test_7_rapid_double_click_lock_prevents_duplicate_fetch(self):
        """Test 7: Rapid double-click -> only one fetch runs."""
        student = Student(
            reg_no="TEST_URL_007",
            name="Test Student 7",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/bharath_k/",
            username="bharath_k"
        )
        self.db.add(student)
        self.db.commit()

        # Simulate lock active
        _active_single_fetches.add(student.id)
        try:
            res = sync_single_student(student.id, self.db, force_refresh=True)
            self.assertEqual(res["status"], "fetching")
            self.assertEqual(res["sync_status"], "FETCHING")
        finally:
            _active_single_fetches.discard(student.id)

    def test_8_backend_restart_latest_saved_url_used(self):
        """Test 8: Backend restart -> latest saved URL is still used from database."""
        student = Student(
            reg_no="TEST_URL_008",
            name="Test Student 8",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/nanthish_s/",
            username="nanthish_s"
        )
        self.db.add(student)
        self.db.commit()

        # Close session to simulate restart
        self.db.close()

        # Re-open session
        new_db = SessionLocal()
        reloaded_student = new_db.query(Student).filter(Student.reg_no == "TEST_URL_008").first()
        self.assertEqual(reloaded_student.leetcode_url, "https://leetcode.com/u/nanthish_s/")
        self.assertEqual(reloaded_student.username, "nanthish_s")
        new_db.close()

    def test_9_frontend_refresh_latest_data_remains(self):
        """Test 9: Frontend refresh -> latest URL and data remain in DB."""
        student = Student(
            reg_no="TEST_URL_009",
            name="Test Student 9",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/bharath_k/",
            username="bharath_k"
        )
        self.db.add(student)
        self.db.commit()

        sync_single_student(student.id, self.db, force_refresh=True)

        self.db.close()
        new_db = SessionLocal()
        fresh_st = new_db.query(Student).filter(Student.reg_no == "TEST_URL_009").first()
        self.assertIsNotNone(fresh_st.stats)
        self.assertIsNotNone(fresh_st.stats.total_solved)
        new_db.close()

    def test_10_username_mismatch_prevents_corrupt_data(self):
        """Test 10: New URL returns different username -> USERNAME_MISMATCH and old data not attached."""
        student = Student(
            reg_no="TEST_URL_010",
            name="Test Student 10",
            department_id=self.dept_id,
            year_level="III",
            leetcode_url="https://leetcode.com/u/expected_user_name/",
            username="expected_user_name"
        )
        self.db.add(student)
        self.db.commit()

        # Simulate fetch response with username mismatch
        fake_mismatch_res = {
            "status": "USERNAME_MISMATCH",
            "username": "expected_user_name",
            "fetched_username": "different_actual_user",
            "error_message": "Identity mismatch: returned 'different_actual_user' != candidate 'expected_user_name'"
        }

        from backend.services.live_sync_service import _process_single_student_sync
        is_success, is_partial, is_error = _process_single_student_sync(self.db, "JOB_TEST_10", student, fake_mismatch_res)

        self.db.refresh(student)
        self.assertEqual(student.stats.sync_status, "identity_mismatch")
        self.assertEqual(student.stats.status, "USERNAME_MISMATCH")
        self.assertFalse(is_success)

if __name__ == "__main__":
    unittest.main()
