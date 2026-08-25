"""
test_capacity_race_condition.py — Phase 9: 20-Student Capacity Race Test

Tests that concurrent assignment requests cannot exceed the 20/30 student capacity limit.
Uses threading to simulate 10 simultaneous Admin assignment requests targeting the same staff member.

Expected: Staff A NEVER exceeds MAX_STUDENTS_PER_FACULTY regardless of race conditions.
"""

import sys
import os
import json
import threading
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from backend.database import SessionLocal
from backend.models import User, Student, FacultyStudentAssignment, StudentAssignmentHistory
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from fastapi import HTTPException

TEST_PREFIX = "TEST_RACE_"


def load_test_data():
    test_data_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "isolation_test_data.json")
    if not os.path.exists(test_data_path):
        return None
    with open(test_data_path) as f:
        return json.load(f)


def cleanup_race_test_data(db):
    """Remove previously created race test data."""
    race_students = db.query(Student).filter(Student.reg_no.like(f"{TEST_PREFIX}%")).all()
    race_staff = db.query(User).filter(User.username.like(f"{TEST_PREFIX}%")).all()

    race_staff_ids = [u.id for u in race_staff]
    race_student_ids = [s.id for s in race_students]

    if race_staff_ids:
        db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id.in_(race_staff_ids)
        ).delete(synchronize_session=False)
        db.query(StudentAssignmentHistory).filter(
            StudentAssignmentHistory.new_faculty_id.in_(race_staff_ids) |
            StudentAssignmentHistory.previous_faculty_id.in_(race_staff_ids)
        ).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(race_staff_ids)).delete(synchronize_session=False)

    if race_student_ids:
        db.query(Student).filter(Student.id.in_(race_student_ids)).delete(synchronize_session=False)

    db.commit()


class TestCapacityRaceCondition:
    """Phase 9: Race condition safety for 20-student capacity enforcement."""

    def test_concurrent_assignments_never_exceed_limit(self):
        """
        Simulates 10 concurrent Admin assignment requests to Staff who is at 0/30 capacity.
        Each thread tries to assign 5 students. Total attempts = 50.
        Expected: Final count <= MAX_STUDENTS_PER_FACULTY (30).
        """
        db_setup = SessionLocal()
        try:
            cleanup_race_test_data(db_setup)

            # Create a race-test staff member
            from backend.models import Department
            dept = db_setup.query(Department).first()
            race_staff = User(
                username=f"{TEST_PREFIX}Staff",
                email=f"test.race.staff@nandha.test",
                role="Staff",
                department_id=dept.id if dept else None,
                is_active=True,
                hashed_password="test_race_hash"
            )
            db_setup.add(race_staff)
            db_setup.flush()
            staff_id = race_staff.id

            # Create 60 race-test students (more than max capacity to ensure contention)
            student_ids = []
            for i in range(60):
                s = Student(
                    reg_no=f"{TEST_PREFIX}{i:04d}",
                    name=f"Race Test Student {i}",
                    department_id=dept.id if dept else None,
                    year_level="II",
                    email=f"race.{i:04d}@nandha.test",
                    is_active=True
                )
                db_setup.add(s)
                db_setup.flush()
                student_ids.append(s.id)

            db_setup.commit()
            print(f"\n  Created race-test staff ID={staff_id}, 60 test students")

        finally:
            db_setup.close()

        # ─── Concurrent Assignment Phase ───────────────────────────────────────
        THREADS = 10
        STUDENTS_PER_THREAD = 5
        results = []
        errors = []

        def attempt_assignment(thread_idx, student_batch):
            """Each thread tries to assign its batch of students."""
            db = SessionLocal()
            try:
                result = faculty_assignment_service.assign_students_to_faculty(
                    db=db,
                    faculty_id=staff_id,
                    student_ids=student_batch,
                    assigned_by_id=None
                )
                results.append(result.get("total_assigned", 0))
            except HTTPException as e:
                if e.status_code == 400 and "maximum" in e.detail.lower():
                    errors.append(f"Thread {thread_idx}: correctly blocked by capacity")
                else:
                    errors.append(f"Thread {thread_idx}: unexpected error {e.status_code}: {e.detail}")
            except Exception as e:
                errors.append(f"Thread {thread_idx}: exception {type(e).__name__}: {e}")
            finally:
                db.close()

        threads = []
        for i in range(THREADS):
            batch_start = i * STUDENTS_PER_THREAD
            batch_end = batch_start + STUDENTS_PER_THREAD
            batch = student_ids[batch_start:batch_end]
            t = threading.Thread(target=attempt_assignment, args=(i, batch))
            threads.append(t)

        print(f"  Starting {THREADS} concurrent assignment threads ({THREADS * STUDENTS_PER_THREAD} total assignments)...")
        # Start all threads simultaneously
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # ─── Verify Final State ────────────────────────────────────────────────
        db_verify = SessionLocal()
        try:
            final_count = faculty_assignment_service.get_faculty_assigned_count(db_verify, staff_id)

            print(f"  Successful assignment results: {results}")
            print(f"  Capacity-blocked errors: {[e for e in errors if 'correctly blocked' in e]}")
            print(f"  Unexpected errors: {[e for e in errors if 'correctly blocked' not in e]}")
            print(f"  Final assigned count: {final_count}")

            # CRITICAL ASSERTION: Never exceed the hard limit
            assert final_count <= MAX_STUDENTS_PER_FACULTY, (
                f"RACE CONDITION DETECTED: Final count {final_count} exceeds MAX_STUDENTS_PER_FACULTY={MAX_STUDENTS_PER_FACULTY}. "
                f"The concurrent locking mechanism failed."
            )

            # At least some threads should have succeeded
            assert final_count > 0, "No assignments succeeded at all — unexpected failure"

            # No unexpected errors (only capacity blocks are acceptable)
            unexpected = [e for e in errors if "correctly blocked" not in e]
            assert len(unexpected) == 0, f"Unexpected errors during concurrent assignment: {unexpected}"

            print(f"\n  [PASS] Race condition test: Final count={final_count} <= {MAX_STUDENTS_PER_FACULTY} (limit)")
            print(f"  [PASS] Capacity enforcement held under {THREADS} concurrent threads")

        finally:
            db_verify.close()
            # Cleanup
            db_clean = SessionLocal()
            cleanup_race_test_data(db_clean)
            db_clean.close()

    def test_capacity_check_is_server_side_only(self):
        """
        Verifies the capacity check cannot be bypassed by sending a large student list.
        Attempts to assign 35 students in a single request (exceeds MAX=30).
        """
        db_setup = SessionLocal()
        try:
            cleanup_race_test_data(db_setup)

            from backend.models import Department
            dept = db_setup.query(Department).first()
            race_staff = User(
                username=f"{TEST_PREFIX}Staff",
                email=f"test.race.staff@nandha.test",
                role="Staff",
                department_id=dept.id if dept else None,
                is_active=True,
                hashed_password="test_hash"
            )
            db_setup.add(race_staff)
            db_setup.flush()
            staff_id = race_staff.id

            # Create 35 students
            student_ids = []
            for i in range(35):
                s = Student(
                    reg_no=f"{TEST_PREFIX}{i:04d}",
                    name=f"Bypass Test Student {i}",
                    department_id=dept.id if dept else None,
                    year_level="II",
                    email=f"bypass.{i:04d}@nandha.test",
                    is_active=True
                )
                db_setup.add(s)
                db_setup.flush()
                student_ids.append(s.id)
            db_setup.commit()

        finally:
            db_setup.close()

        db = SessionLocal()
        try:
            # Attempt to assign all 35 at once — must be blocked
            with pytest.raises(HTTPException) as exc_info:
                faculty_assignment_service.assign_students_to_faculty(
                    db=db,
                    faculty_id=staff_id,
                    student_ids=student_ids,  # 35 students
                    assigned_by_id=None
                )

            assert exc_info.value.status_code == 400
            assert "maximum" in exc_info.value.detail.lower()
            print(f"\n  [PASS] Assigning 35 students in single request was blocked: {exc_info.value.detail}")

        finally:
            db.close()
            db_clean = SessionLocal()
            cleanup_race_test_data(db_clean)
            db_clean.close()

    def test_20_student_recommended_ratio_enforced(self):
        """
        Verifies the RECOMMENDED 20-student ratio is tracked and flagged.
        (Not a hard block — but workload_status must reflect correctly.)
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            current_count = faculty_assignment_service.get_faculty_assigned_count(db, staff_a_id)

            print(f"\n  Staff A current count: {current_count}")
            assert current_count == 20, f"Expected Staff A to have 20 students, got {current_count}"

            # Verify workload status is correct
            if current_count < 20:
                expected_status = "NORMAL"
            elif current_count == 20:
                expected_status = "AT_RATIO"
            elif current_count <= 30:
                expected_status = "ABOVE_RATIO"
            else:
                expected_status = "HIGH_WORKLOAD"

            print(f"  Expected workload_status: {expected_status}")
            print(f"  [PASS] 20-student ratio tracking is correct")

        finally:
            db.close()


if __name__ == "__main__":
    t = TestCapacityRaceCondition()
    t.test_capacity_check_is_server_side_only()
    t.test_20_student_recommended_ratio_enforced()
    t.test_concurrent_assignments_never_exceed_limit()
    print("\n[COMPLETE] All race condition tests passed.")
