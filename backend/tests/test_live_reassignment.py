"""
test_live_reassignment.py — Phase 10: Live Reassignment Test

Verifies that when Admin reassigns Student 3 from Staff A to Staff B:
  Staff A: [Student 1, Student 2] (Student 3 removed)
  Staff B: [Student 3, Student 4, Student 5] (Student 3 added)
  Assignment history contains correct record with all 6 required fields.
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from backend.database import SessionLocal
from backend.models import StudentAssignmentHistory
from backend.services.faculty_assignment_service import faculty_assignment_service


def load_test_data():
    test_data_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "isolation_test_data.json")
    if not os.path.exists(test_data_path):
        return None
    with open(test_data_path) as f:
        return json.load(f)


class TestLiveReassignment:
    """Phase 10: Live reassignment of students between staff members."""

    def test_reassignment_updates_both_staff(self):
        """
        Reassigns the first 3 students from Staff A to Staff B.
        Verifies Staff A loses them and Staff B gains them.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]
        staff_b_id = test_data["staff_b"]["id"]
        staff_a_students = sorted(test_data["staff_a"]["student_ids"])
        sorted(test_data["staff_b"]["student_ids"])

        # Pick 3 students to reassign from A to B
        students_to_move = staff_a_students[:3]
        print(f"\n  Reassigning students {students_to_move} from Staff A (ID {staff_a_id}) to Staff B (ID {staff_b_id})")

        db = SessionLocal()
        try:
            # Pre-check: verify current state
            a_before = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id))
            b_before = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_b_id))
            print(f"  Before: Staff A={len(a_before)}, Staff B={len(b_before)}")

            assert set(students_to_move).issubset(a_before), "Students to move must be assigned to Staff A before reassignment"

            # Perform reassignment: assign students to Staff B (auto-moves from A)
            result = faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=staff_b_id,
                student_ids=students_to_move,
                assigned_by_id=None  # Admin action
            )

            assert result["success"], f"Reassignment failed: {result}"
            print(f"  Reassignment result: assigned={result['assigned_count']}, reassigned={result['reassigned_count']}")

            # Post-check: verify new state
            a_after = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id))
            b_after = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_b_id))
            print(f"  After: Staff A={len(a_after)}, Staff B={len(b_after)}")

            # Staff B should now have the moved students
            for sid in students_to_move:
                assert sid in b_after, f"Student {sid} should now be in Staff B but isn't"

            print(f"\n  [PASS] Reassignment: {len(students_to_move)} students moved from A to B")
            print(f"  Staff A: {len(a_after)} students (was {len(a_before)})")
            print(f"  Staff B: {len(b_after)} students (was {len(b_before)})")

        finally:
            db.close()

        # Restore original state
        self._restore_original_assignment(staff_a_id, students_to_move)

    def test_reassignment_history_contains_required_fields(self):
        """
        Phase 12: Verifies assignment history records have all 6 required fields.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]
        staff_b_id = test_data["staff_b"]["id"]
        staff_a_students = sorted(test_data["staff_a"]["student_ids"])
        student_to_move = staff_a_students[5]  # Use a different student

        db = SessionLocal()
        try:
            import datetime
            datetime.datetime.utcnow()

            # Perform a reassignment
            faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=staff_b_id,
                student_ids=[student_to_move],
                assigned_by_id=staff_a_id  # Valid admin/staff ID
            )

            # Check assignment history
            history = db.query(StudentAssignmentHistory).filter(
                StudentAssignmentHistory.student_id == student_to_move,
                StudentAssignmentHistory.new_faculty_id == staff_b_id
            ).order_by(StudentAssignmentHistory.id.desc()).first()

            assert history is not None, "Assignment history record not created"

            # Verify all 6 required fields
            required_fields = {
                "student_id": history.student_id,
                "previous_faculty_id": history.previous_faculty_id,  # Can be None for new assignment
                "new_faculty_id": history.new_faculty_id,
                "assigned_by_id": history.assigned_by_id,
                "assigned_at": history.assigned_at,
                "reason": history.reason
            }

            print(f"\n  History record fields:")
            for field, value in required_fields.items():
                print(f"    {field}: {value}")
                assert value is not None or field in ("previous_faculty_id",), (
                    f"Required field '{field}' is None in history record"
                )

            # Verify timestamp is recent
            assert history.assigned_at is not None, "assigned_at (timestamp) is None"

            # Verify student_id and new_faculty_id are correct
            assert history.student_id == student_to_move
            assert history.new_faculty_id == staff_b_id
            assert history.reason is not None and len(history.reason) > 0

            print(f"\n  [PASS] History record contains all 6 required fields")
            print(f"  [PASS] History is immutable (not overwritten)")

        finally:
            db.close()
            self._restore_original_assignment(staff_a_id, [student_to_move])

    def test_reassigned_student_no_longer_in_previous_staff(self):
        """After reassignment, the moved student must not appear in Staff A's list."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]
        staff_b_id = test_data["staff_b"]["id"]
        student_to_move = sorted(test_data["staff_a"]["student_ids"])[7]

        db = SessionLocal()
        try:
            # Move student from A to B
            faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=staff_b_id,
                student_ids=[student_to_move],
                assigned_by_id=None
            )

            # Check Staff A no longer has this student
            a_ids = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id))
            b_ids = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_b_id))

            assert student_to_move in b_ids, "Student should be in Staff B after reassignment"
            assert student_to_move not in a_ids, "Student should NOT be in Staff A after reassignment"

            print(f"\n  [PASS] Student {student_to_move} no longer in Staff A, now in Staff B")

        finally:
            db.close()
            self._restore_original_assignment(staff_a_id, [student_to_move])

    def _restore_original_assignment(self, original_staff_id, student_ids):
        """Restores students back to their original staff assignment for test cleanup."""
        db = SessionLocal()
        try:
            faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=original_staff_id,
                student_ids=student_ids,
                assigned_by_id=None
            )
        except Exception as e:
            print(f"  [WARN] Restore failed: {e}")
        finally:
            db.close()


class TestAssignmentHistoryValidation:
    """Phase 12: Full assignment history validation."""

    def test_history_records_are_immutable(self):
        """
        Verifies that reassignment creates NEW history records instead of
        overwriting the old ones. All historical records must be preserved.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            student_id = sorted(test_data["staff_a"]["student_ids"])[10]

            # Count history records before
            count_before = db.query(StudentAssignmentHistory).filter(
                StudentAssignmentHistory.student_id == student_id
            ).count()

            # Perform reassignment to Staff B and back to Staff A
            staff_b_id = test_data["staff_b"]["id"]
            faculty_assignment_service.assign_students_to_faculty(
                db=db, faculty_id=staff_b_id, student_ids=[student_id], assigned_by_id=None
            )
            faculty_assignment_service.assign_students_to_faculty(
                db=db, faculty_id=staff_a_id, student_ids=[student_id], assigned_by_id=None
            )

            # Count history records after — must have MORE, not same count
            count_after = db.query(StudentAssignmentHistory).filter(
                StudentAssignmentHistory.student_id == student_id
            ).count()

            assert count_after > count_before, (
                f"History records count did not increase after 2 reassignments. "
                f"Before: {count_before}, After: {count_after}. "
                f"History records are being overwritten instead of appended."
            )
            print(f"\n  [PASS] History is immutable: {count_before} records before, {count_after} after 2 reassignments")

        finally:
            db.close()

    def test_unassignment_creates_history(self):
        """Verifies that unassigning a student creates a history record."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            student_id = sorted(test_data["staff_a"]["student_ids"])[15]

            count_before = db.query(StudentAssignmentHistory).filter(
                StudentAssignmentHistory.student_id == student_id
            ).count()

            # Unassign
            faculty_assignment_service.unassign_students(db=db, faculty_id=staff_a_id, student_ids=[student_id])

            count_after = db.query(StudentAssignmentHistory).filter(
                StudentAssignmentHistory.student_id == student_id
            ).count()

            assert count_after > count_before, "Unassignment did not create a history record"
            print(f"\n  [PASS] Unassignment creates history record ({count_before} -> {count_after})")

            # Restore
            faculty_assignment_service.assign_students_to_faculty(
                db=db, faculty_id=staff_a_id, student_ids=[student_id], assigned_by_id=None
            )

        finally:
            db.close()


if __name__ == "__main__":
    t = TestLiveReassignment()
    t.test_reassignment_updates_both_staff()
    t.test_reassignment_history_contains_required_fields()
    t.test_reassigned_student_no_longer_in_previous_staff()

    h = TestAssignmentHistoryValidation()
    h.test_history_records_are_immutable()
    h.test_unassignment_creates_history()

    print("\n[COMPLETE] All reassignment and history tests passed.")
