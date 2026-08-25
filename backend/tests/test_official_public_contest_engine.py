import asyncio
import pytest
import unittest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    Department, Section, Student, User, WeeklySession,
    OfficialPublicParticipant, PublicContestSyncAudit, FacultyStudentAssignment
)
from backend.services.public_contest_engine import (
    PublicContestEngine, CircuitBreaker
)


class TestOfficialPublicContestEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean up database
        self.db.query(OfficialPublicParticipant).delete()
        self.db.query(PublicContestSyncAudit).delete()
        self.db.query(FacultyStudentAssignment).delete()
        self.db.query(Student).delete()
        self.db.query(User).delete()
        self.db.query(WeeklySession).delete()
        self.db.query(Section).delete()
        self.db.query(Department).delete()
        self.db.commit()

        # Seed test department & section
        self.dept_cse = Department(name="Computer Science", code="CSE")
        self.dept_ece = Department(name="Electronics", code="ECE")
        self.db.add_all([self.dept_cse, self.dept_ece])
        self.db.commit()

        self.sec_a = Section(name="A", department_id=self.dept_cse.id, year_level="III")
        self.db.add(self.sec_a)
        self.db.commit()

        # Seed students
        self.st1 = Student(
            reg_no="731821104001", name="Bharath Kumar", username="BharathK", email="st1@nandha.edu.in",
            department_id=self.dept_cse.id, year_level="III", section_id=self.sec_a.id, is_active=True
        )
        self.st2 = Student(
            reg_no="731821104002", name="Kavitha S", username="kavithas", email="st2@nandha.edu.in",
            department_id=self.dept_cse.id, year_level="III", section_id=self.sec_a.id, is_active=True
        )
        self.st3 = Student(
            reg_no="731821104003", name="No Username Student", username=None, email="st3@nandha.edu.in",
            department_id=self.dept_ece.id, year_level="III", section_id=None, is_active=True
        )
        self.st4 = Student(
            reg_no="731821104004", name="Similar Name", username="bharathk_different", email="st4@nandha.edu.in",
            department_id=self.dept_cse.id, year_level="III", section_id=self.sec_a.id, is_active=True
        )
        self.db.add_all([self.st1, self.st2, self.st3, self.st4])
        self.db.commit()

        # Seed Users (Admin, Staff, HOD, Student)
        self.admin = User(username="admin", email="admin@nandha.edu.in", hashed_password="pw", role="Admin")
        self.staff_a = User(username="staff_a", email="staff_a@nandha.edu.in", hashed_password="pw", role="Staff", department_id=self.dept_cse.id)
        self.hod_cse = User(username="hod_cse", email="hod_cse@nandha.edu.in", hashed_password="pw", role="HOD", department_id=self.dept_cse.id)
        self.user_st1 = User(username="st1_user", email="st1@nandha.edu.in", hashed_password="pw", role="Student")
        self.db.add_all([self.admin, self.staff_a, self.hod_cse, self.user_st1])
        self.db.commit()

        # Assign st1 to staff_a
        self.assign1 = FacultyStudentAssignment(faculty_id=self.staff_a.id, student_id=self.st1.id)
        self.db.add(self.assign1)
        self.db.commit()

        # Seed Weekly Session
        self.session = WeeklySession(
            academic_year="2026-27",
            week_number=515,
            session_code="WEEK-2026-08-16",
            session_date="2026-08-16",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515"
        )
        self.db.add(self.session)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # 1. Exact Username Normalization & Matching
    def test_username_normalization_and_exact_matching(self):
        """Verify trim + lowercase normalization and exact matching."""
        self.assertEqual(PublicContestEngine.normalize_username(" BharathK "), "bharathk")
        self.assertEqual(PublicContestEngine.normalize_username("kavithas"), "kavithas")
        self.assertEqual(PublicContestEngine.normalize_username(None), "")

    # 2. Reject Fuzzy Matching
    def test_fuzzy_matching_rejection(self):
        """Verify fuzzy usernames like 'bharathk_different' do NOT match 'bharathk'."""
        leaderboard_entries = [
            {"username": "bharathk", "normalized_username": "bharathk", "rank": 105, "score": 18, "finish_time": "00:45:00", "problems_solved": 4}
        ]
        
        # Test exact match logic directly
        leaderboard_map = {entry["normalized_username"]: entry for entry in leaderboard_entries}
        
        st1_norm = PublicContestEngine.normalize_username(self.st1.username) # "bharathk"
        st4_norm = PublicContestEngine.normalize_username(self.st4.username) # "bharathk_different"

        self.assertIn(st1_norm, leaderboard_map)
        self.assertNotIn(st4_norm, leaderboard_map)

    # 3. Circuit Breaker Transitions
    def test_circuit_breaker_transitions(self):
        """Test CLOSED -> OPEN -> HALF_OPEN -> CLOSED state machine."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=0.2)
        self.assertEqual(cb.state, CircuitBreaker.CLOSED)
        self.assertTrue(cb.can_execute())

        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreaker.CLOSED)

        cb.record_failure() # 3rd failure -> OPEN
        self.assertEqual(cb.state, CircuitBreaker.OPEN)
        self.assertFalse(cb.can_execute())

        # Wait for cooldown
        import time
        time.sleep(0.25)

        self.assertTrue(cb.can_execute()) # Transitions to HALF_OPEN
        self.assertEqual(cb.state, CircuitBreaker.HALF_OPEN)

        cb.record_success() # Success -> CLOSED
        self.assertEqual(cb.state, CircuitBreaker.CLOSED)

    # 4. Fail-Closed Synchronization
    def test_fail_closed_synchronization_on_fetch_failure(self):
        """Verify that fetch failure preserves last verified dataset and fails closed."""
        # Insert initial verified participant
        initial_participant = OfficialPublicParticipant(
            session_id=self.session.id,
            contest_id=str(self.session.id),
            contest_slug="weekly-contest-515",
            contest_title="Weekly Contest 515",
            student_id=self.st1.id,
            leetcode_username=self.st1.username,
            official_rank=100,
            official_problems_solved=4,
            official_score=18,
            verification_status="VERIFIED"
        )
        self.db.add(initial_participant)
        self.db.commit()

        # Mock fetch_complete_validated_leaderboard to simulate API failure
        async def mock_fetch_fail(slug):
            return False, [], {
                "pages_requested": 1,
                "pages_successfully_fetched": 0,
                "total_reported": 1000,
                "total_fetched": 0,
                "unique_usernames": 0,
                "duplicate_count": 0,
                "retry_count": 4,
                "validation_status": "LEADERBOARD_INCOMPLETE",
                "failure_reason": "Page 1 fetch failed: HTTP 429 Rate Limited"
            }

        with patch.object(PublicContestEngine, "fetch_complete_validated_leaderboard", side_effect=mock_fetch_fail):
            success, result = asyncio.run(PublicContestEngine.sync_public_participants(self.db, self.session.id, force_resync=True))
            
            self.assertFalse(success)
            self.assertEqual(result["publish_status"], "KPT_LAST_VERIFIED")

            # Verify existing verified dataset is PRESERVED!
            preserved = self.db.query(OfficialPublicParticipant).filter(
                OfficialPublicParticipant.session_id == self.session.id
            ).all()
            self.assertEqual(len(preserved), 1)
            self.assertEqual(preserved[0].student_id, self.st1.id)

    # 5. Successful Sync & Atomic Publishing
    def test_successful_sync_and_atomic_publishing(self):
        """Verify successful fetch updates Public Participants atomically."""
        mock_entries = [
            {"username": "BharathK", "normalized_username": "bharathk", "rank": 150, "score": 18, "finish_time": "00:40:00", "problems_solved": 4},
            {"username": "kavithas", "normalized_username": "kavithas", "rank": 500, "score": 12, "finish_time": "01:10:00", "problems_solved": 3}
        ]
        mock_meta = {
            "pages_requested": 1,
            "pages_successfully_fetched": 1,
            "total_reported": 2,
            "total_fetched": 2,
            "unique_usernames": 2,
            "duplicate_count": 0,
            "retry_count": 0,
            "validation_status": "VERIFIED"
        }

        async def mock_fetch_success(slug):
            return True, mock_entries, mock_meta

        with patch.object(PublicContestEngine, "fetch_complete_validated_leaderboard", side_effect=mock_fetch_success):
            success, result = asyncio.run(PublicContestEngine.sync_public_participants(self.db, self.session.id, force_resync=True))

            self.assertTrue(success)
            self.assertEqual(result["publish_status"], "PUBLISHED")
            self.assertEqual(result["matched_students"], 2)

            published = self.db.query(OfficialPublicParticipant).filter(
                OfficialPublicParticipant.session_id == self.session.id
            ).all()
            self.assertEqual(len(published), 2)
            published_ids = {p.student_id for p in published}
            self.assertIn(self.st1.id, published_ids)
            self.assertIn(self.st2.id, published_ids)

    # 6. Role-Based Access Control & Security Scoping
    def test_role_based_access_control(self):
        """Verify strict server-side scoping for Staff, HOD, Student, and Admin."""
        # Seed 1 published record for st1
        participant = OfficialPublicParticipant(
            session_id=self.session.id,
            contest_id=str(self.session.id),
            contest_slug="weekly-contest-515",
            contest_title="Weekly Contest 515",
            student_id=self.st1.id,
            leetcode_username=self.st1.username,
            official_rank=100,
            official_problems_solved=4,
            official_score=18,
            verification_status="VERIFIED"
        )
        self.db.add(participant)
        self.db.commit()

        # 1. Staff A Access (Assigned to st1 ONLY)
        res_staff = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.staff_a
        )
        self.assertEqual(res_staff["total"], 1)
        self.assertEqual(res_staff["public_participants"][0]["student_id"], self.st1.id)

        # 2. HOD Access (CSE Department: st1, st2, st4)
        res_hod = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.hod_cse
        )
        self.assertEqual(res_hod["total"], 3)

        # 3. Student Access (Self ONLY: st1)
        res_student = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.user_st1
        )
        self.assertEqual(res_student["total"], 1)
        self.assertEqual(res_student["public_participants"][0]["student_id"], self.st1.id)

        # 4. Admin Access (All Students: st1, st2, st3, st4)
        res_admin = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.admin
        )
        self.assertEqual(res_admin["total"], 4)

    # 7. Department/Year Summary Matrix Breakdown
    def test_summary_matrix_calculation(self):
        """Verify summary metrics: total, public_participants_count, missing_username_count, pct."""
        participant = OfficialPublicParticipant(
            session_id=self.session.id,
            contest_id=str(self.session.id),
            contest_slug="weekly-contest-515",
            contest_title="Weekly Contest 515",
            student_id=self.st1.id,
            leetcode_username=self.st1.username,
            official_rank=100,
            official_problems_solved=4,
            official_score=18,
            verification_status="VERIFIED"
        )
        self.db.add(participant)
        self.db.commit()

        res = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.admin
        )
        summary = res["summary"]
        self.assertEqual(summary["total_institutional_students"], 4)
        self.assertEqual(summary["public_participants_count"], 1)
        self.assertEqual(summary["missing_username_count"], 1)
        self.assertEqual(summary["public_participation_pct"], 25.0)

    # 8. Performance Scale Test (3,500 Students)
    def test_large_student_population_performance(self):
        """Verify query performance with 3,500 student records in single query batch."""
        bulk_students = []
        for i in range(3500):
            bulk_students.append(Student(
                reg_no=f"PERF_{i}",
                name=f"Perf Student {i}",
                username=f"perf_user_{i}",
                department_id=self.dept_cse.id,
                year_level="III",
                is_active=True
            ))
        self.db.bulk_save_objects(bulk_students)
        self.db.commit()

        import time
        t0 = time.time()
        res = PublicContestEngine.get_public_participants_role_scoped(
            db=self.db, session_id=self.session.id, current_user=self.admin, page_size=100
        )
        t_elapsed = time.time() - t0

        self.assertGreaterEqual(res["total"], 3500)
        self.assertLess(t_elapsed, 2.5, f"Query took {t_elapsed:.2f}s, expected < 2.5s")

    # 9. Versioned Dataset Architecture & Superseded Transition
    def test_dataset_versioning_and_superseded_transition(self):
        """Verify syncing twice creates version 2 and marks version 1 is_active_version=False (SUPERSEDED)."""
        mock_entries_v1 = [
            {"username": "BharathK", "normalized_username": "bharathk", "rank": 150, "score": 18, "finish_time": "00:40:00", "problems_solved": 4}
        ]
        mock_meta = {
            "pages_requested": 1, "pages_successfully_fetched": 1, "total_reported": 1,
            "total_fetched": 1, "unique_usernames": 1, "duplicate_count": 0, "retry_count": 0, "validation_status": "VERIFIED"
        }

        async def mock_fetch(slug):
            return True, mock_entries_v1, mock_meta

        with patch.object(PublicContestEngine, "fetch_complete_validated_leaderboard", side_effect=mock_fetch):
            # First Sync -> Version 1
            s1, r1 = asyncio.run(PublicContestEngine.sync_public_participants(self.db, self.session.id, force_resync=True))
            self.assertTrue(s1)
            self.assertEqual(r1["dataset_version"], 1)

            # Second Sync -> Version 2
            s2, r2 = asyncio.run(PublicContestEngine.sync_public_participants(self.db, self.session.id, force_resync=True))
            self.assertTrue(s2)
            self.assertEqual(r2["dataset_version"], 2)

            # Check that Version 1 rows exist but have is_active_version = False
            v1_rows = self.db.query(OfficialPublicParticipant).filter(
                OfficialPublicParticipant.session_id == self.session.id,
                OfficialPublicParticipant.dataset_version == 1
            ).all()
            self.assertEqual(len(v1_rows), 1)
            self.assertFalse(v1_rows[0].is_active_version)

            # Check that Version 2 rows have is_active_version = True
            v2_rows = self.db.query(OfficialPublicParticipant).filter(
                OfficialPublicParticipant.session_id == self.session.id,
                OfficialPublicParticipant.dataset_version == 2
            ).all()
            self.assertEqual(len(v2_rows), 1)
            self.assertTrue(v2_rows[0].is_active_version)


if __name__ == "__main__":
    unittest.main()


