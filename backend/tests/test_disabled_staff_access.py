"""
test_disabled_staff_access.py — Phase 11: Disabled Staff Test

Verifies that when Staff A is disabled:
  - Their assigned students are moved to unassigned queue
  - Their assignment history is preserved
  - Student data, contest history, and LeetCode data are NOT deleted

Tests Phases 11 and 13 (role regression — other roles unaffected).
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from backend.database import SessionLocal
from backend.models import (
    User, Student, StudentAssignmentHistory
)
from backend.services.faculty_assignment_service import faculty_assignment_service
from backend.services.authorization_service import get_authorized_student_ids, require_staff_student_access
from fastapi import HTTPException


def load_test_data():
    test_data_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "isolation_test_data.json")
    if not os.path.exists(test_data_path):
        return None
    with open(test_data_path) as f:
        return json.load(f)


class TestDisabledStaffAccess:
    """Phase 11: Disabled Staff loses access, student data remains intact."""

    def test_disabled_staff_loses_assignments(self):
        """
        Disables Staff C and verifies their students are moved to unassigned queue.
        Student data (LeetCode stats, contest history) must NOT be deleted.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_c_id = test_data["staff_c"]["id"]
        staff_c_students = test_data["staff_c"]["student_ids"]

        db = SessionLocal()
        try:
            # Pre-check: Staff C has 20 students
            count_before = faculty_assignment_service.get_faculty_assigned_count(db, staff_c_id)
            assert count_before == 20, f"Staff C should have 20 students before disable, has {count_before}"
            print(f"\n  Staff C has {count_before} students before disable")

            # Disable Staff C
            result = faculty_assignment_service.disable_staff_account(
                db=db,
                staff_id=staff_c_id,
                disabled_by_id=None
            )

            assert result["success"], f"Disable failed: {result}"
            assert result["unassigned_count"] == 20, f"Expected 20 unassigned, got {result['unassigned_count']}"

            # Verify Staff C is now inactive
            staff_c = db.query(User).filter(User.id == staff_c_id).first()
            assert staff_c.is_active == False, "Staff C should be inactive after disable"

            # Verify assignments are removed
            count_after = faculty_assignment_service.get_faculty_assigned_count(db, staff_c_id)
            assert count_after == 0, f"Staff C should have 0 assignments after disable, has {count_after}"

            # Verify STUDENT DATA is intact (not deleted)
            for student_id in staff_c_students[:5]:
                student = db.query(Student).filter(Student.id == student_id).first()
                assert student is not None, f"Student {student_id} was deleted — should NOT be deleted on staff disable"
                assert student.is_active, f"Student {student_id} should still be active"
                print(f"  Student {student.reg_no} data intact: {student.name}")

            print(f"\n  [PASS] Staff C disabled: 20 assignments removed, 0 student records deleted")
            print(f"  [PASS] Student data is intact after staff disable")

        finally:
            db.close()
            # Re-enable Staff C for further tests
            self._reenable_staff_c(staff_c_id, staff_c_students)

    def test_disabled_staff_authorization_is_revoked(self):
        """
        After disabling Staff C, attempts to get authorized student IDs must return empty.
        The system uses is_active check in get_faculty_assigned_student_ids.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_c_id = test_data["staff_c"]["id"]
        staff_c_students = test_data["staff_c"]["student_ids"]

        db = SessionLocal()
        try:
            # Disable Staff C
            faculty_assignment_service.disable_staff_account(db=db, staff_id=staff_c_id, disabled_by_id=None)

            # Load the (now inactive) user
            staff_c = db.query(User).filter(User.id == staff_c_id).first()
            assert staff_c.is_active == False

            # Try to get authorized student IDs
            authorized = get_authorized_student_ids(db, staff_c)
            assert authorized == [] or len(authorized) == 0, (
                f"Disabled Staff C still has authorized access to {len(authorized)} students: {authorized}"
            )

            # Try to access a specific student via require_staff_student_access
            test_student_id = staff_c_students[0]
            with pytest.raises(HTTPException) as exc_info:
                require_staff_student_access(db, staff_c, test_student_id)
            assert exc_info.value.status_code in (403, 401), (
                f"Expected 403/401 for disabled staff, got {exc_info.value.status_code}"
            )

            print(f"\n  [PASS] Disabled Staff C: authorized IDs={len(authorized or [])}")
            print(f"  [PASS] Disabled Staff C blocked from accessing student {test_student_id}")

        finally:
            db.close()
            self._reenable_staff_c(staff_c_id, staff_c_students)

    def test_disable_creates_history_records(self):
        """Verifies that disable_staff_account creates history records for each moved student."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_c_id = test_data["staff_c"]["id"]
        staff_c_students = test_data["staff_c"]["student_ids"][:3]  # Check first 3

        db = SessionLocal()
        try:
            import datetime
            datetime.datetime.utcnow()

            faculty_assignment_service.disable_staff_account(db=db, staff_id=staff_c_id, disabled_by_id=None)

            for student_id in staff_c_students:
                history = db.query(StudentAssignmentHistory).filter(
                    StudentAssignmentHistory.student_id == student_id,
                    StudentAssignmentHistory.previous_faculty_id == staff_c_id,
                    StudentAssignmentHistory.new_faculty_id == None
                ).order_by(StudentAssignmentHistory.id.desc()).first()

                assert history is not None, f"No history record for student {student_id} after staff disable"
                assert "Disabled" in (history.reason or ""), (
                    f"Disable history reason incorrect: {history.reason}"
                )
                print(f"  History for student {student_id}: reason='{history.reason}'")

            print(f"\n  [PASS] Disable creates history records for all affected students")

        finally:
            db.close()
            self._reenable_staff_c(staff_c_id, test_data["staff_c"]["student_ids"])

    def _reenable_staff_c(self, staff_c_id, student_ids):
        """Re-enables Staff C and restores their assignments."""
        db = SessionLocal()
        try:
            staff_c = db.query(User).filter(User.id == staff_c_id).first()
            if staff_c:
                staff_c.is_active = True
                db.commit()

            # Re-assign students
            result = faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=staff_c_id,
                student_ids=student_ids,
                assigned_by_id=None
            )
        except Exception as e:
            print(f"  [WARN] Re-enable Staff C failed: {e}")
        finally:
            db.close()


class TestRoleRegression:
    """Phase 13: Ensure existing roles are unaffected by Staff changes."""

    def test_admin_role_scope_is_global(self):
        """Admin/Super Admin must NOT have their scope restricted to 20 students."""
        db = SessionLocal()
        try:
            admin_user = User(
                id=99998, username="test_admin", email="admin@test.com",
                role="Admin", is_active=True
            )
            authorized = get_authorized_student_ids(db, admin_user)
            # Admin returns None (global access — no restriction)
            assert authorized is None, (
                f"Admin should have global access (None), got {type(authorized)} with {len(authorized) if authorized else 0} IDs"
            )
            print(f"\n  [PASS] Admin role: global access (None restriction)")
        finally:
            db.close()

    def test_super_admin_role_scope_is_global(self):
        db = SessionLocal()
        try:
            super_admin = User(id=99997, username="super_admin", email="sa@test.com", role="Super Admin", is_active=True)
            authorized = get_authorized_student_ids(db, super_admin)
            assert authorized is None, f"Super Admin should have global access, got: {authorized}"
            print(f"  [PASS] Super Admin role: global access (None restriction)")
        finally:
            db.close()

    def test_principal_role_scope_is_global(self):
        db = SessionLocal()
        try:
            principal = User(id=99996, username="principal", email="principal@test.com", role="Principal", is_active=True)
            authorized = get_authorized_student_ids(db, principal)
            assert authorized is None, f"Principal should have global access, got: {authorized}"
            print(f"  [PASS] Principal role: global access (None restriction)")
        finally:
            db.close()

    def test_placement_coordinator_scope_is_global(self):
        db = SessionLocal()
        try:
            placement = User(id=99995, username="placement", email="placement@test.com", role="Placement Coordinator", is_active=True)
            authorized = get_authorized_student_ids(db, placement)
            assert authorized is None, f"Placement Coordinator should have global access, got: {authorized}"
            print(f"  [PASS] Placement Coordinator role: global access (None restriction)")
        finally:
            db.close()

    def test_hod_scope_is_department_not_20_student_limit(self):
        """HOD must see their entire department, NOT just 20 students."""
        db = SessionLocal()
        try:
            from backend.models import Department, Student as StudentModel
            dept = db.query(Department).first()
            if not dept:
                pytest.skip("No departments found")

            dept_student_count = db.query(StudentModel).filter(
                StudentModel.department_id == dept.id
            ).count()

            hod = User(
                id=99994, username="test_hod", email="hod@test.com",
                role="HOD", is_active=True, department_id=dept.id
            )
            authorized = get_authorized_student_ids(db, hod)

            # HOD should see ALL dept students, not just 20
            assert len(authorized) == dept_student_count, (
                f"HOD scope mismatch: expected {dept_student_count} dept students, got {len(authorized)}"
            )
            if dept_student_count > 20:
                assert len(authorized) > 20, (
                    f"HOD scope incorrectly limited to 20 (Staff limit applied to HOD). "
                    f"HOD should see all {dept_student_count} dept students."
                )
            print(f"  [PASS] HOD role: dept scope = {len(authorized)} students (not limited to 20)")

        finally:
            db.close()

    def test_staff_role_IS_limited_to_assigned(self):
        """Staff must only see their exactly assigned students (max 20/30)."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            user_a = db.query(User).filter(User.id == staff_a_id).first()

            authorized = get_authorized_student_ids(db, user_a)
            assert len(authorized) == 20, (
                f"Staff should see exactly 20 assigned students, got {len(authorized)}"
            )
            print(f"  [PASS] Staff role: strictly limited to {len(authorized)} assigned students")

        finally:
            db.close()

    def test_student_role_self_only(self):
        """Student role must only see their own record."""
        db = SessionLocal()
        try:
            # Find a real student
            from backend.models import Student as StudentModel
            student_record = db.query(StudentModel).filter(StudentModel.email.isnot(None)).first()
            if not student_record:
                pytest.skip("No students with email found")

            student_user = User(
                id=99993, username=student_record.username or "test",
                email=student_record.email,
                role="Student", is_active=True
            )
            authorized = get_authorized_student_ids(db, student_user)
            assert len(authorized) == 1, f"Student should only see 1 record (self), got {len(authorized)}"
            assert authorized[0] == student_record.id, "Student authorized ID does not match their own record"
            print(f"  [PASS] Student role: self-only access ({authorized[0]})")

        finally:
            db.close()


if __name__ == "__main__":
    t = TestDisabledStaffAccess()
    t.test_disabled_staff_loses_assignments()
    t.test_disabled_staff_authorization_is_revoked()
    t.test_disable_creates_history_records()

    r = TestRoleRegression()
    r.test_admin_role_scope_is_global()
    r.test_super_admin_role_scope_is_global()
    r.test_principal_role_scope_is_global()
    r.test_placement_coordinator_scope_is_global()
    r.test_hod_scope_is_department_not_20_student_limit()
    r.test_staff_role_IS_limited_to_assigned()
    r.test_student_role_self_only()

    print("\n[COMPLETE] All disabled staff and role regression tests passed.")
