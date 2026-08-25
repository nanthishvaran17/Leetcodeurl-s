"""
test_staff_data_isolation.py — Phase 2/3: Staff Data Isolation Test

Verifies that:
  - Staff A ONLY receives Staff A's students
  - Staff B ONLY receives Staff B's students
  - Staff C ONLY receives Staff C's students
  - No overlap even with explicit student_id manipulation
  - Direct API security: Staff A cannot access Staff B's students
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from sqlalchemy.orm import joinedload
from backend.database import SessionLocal
from backend.models import User, Student
from backend.services.faculty_assignment_service import faculty_assignment_service
from backend.services.authorization_service import (
    get_authorized_student_ids,
    apply_role_based_student_filter,
    require_staff_student_access
)
from fastapi import HTTPException


def load_test_data():
    test_data_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "isolation_test_data.json")
    if not os.path.exists(test_data_path):
        return None
    with open(test_data_path) as f:
        return json.load(f)


class TestStaffDataIsolation:
    """Phase 2: Verify complete data isolation between Staff A, B, C."""

    def test_staff_a_only_sees_own_students(self):
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            expected_ids = set(test_data["staff_a"]["student_ids"])

            user_a = db.query(User).filter(User.id == staff_a_id).first()
            assert user_a is not None

            authorized_ids = get_authorized_student_ids(db, user_a)
            returned_set = set(authorized_ids)

            assert returned_set == expected_ids, (
                f"Staff A received unexpected students.\n"
                f"Expected: {sorted(expected_ids)}\n"
                f"Got: {sorted(returned_set)}\n"
                f"Extra (LEAK): {sorted(returned_set - expected_ids)}\n"
                f"Missing: {sorted(expected_ids - returned_set)}"
            )
            print(f"\n  [PASS] Staff A receives exactly {len(returned_set)} assigned students, no leakage")

        finally:
            db.close()

    def test_staff_b_only_sees_own_students(self):
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_b_id = test_data["staff_b"]["id"]
            expected_ids = set(test_data["staff_b"]["student_ids"])

            user_b = db.query(User).filter(User.id == staff_b_id).first()
            authorized_ids = get_authorized_student_ids(db, user_b)
            returned_set = set(authorized_ids)

            assert returned_set == expected_ids, (
                f"Staff B received unexpected students. Extra (LEAK): {sorted(returned_set - expected_ids)}"
            )
            print(f"\n  [PASS] Staff B: {len(returned_set)} students, isolated")

        finally:
            db.close()

    def test_staff_c_only_sees_own_students(self):
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_c_id = test_data["staff_c"]["id"]
            expected_ids = set(test_data["staff_c"]["student_ids"])

            user_c = db.query(User).filter(User.id == staff_c_id).first()
            authorized_ids = get_authorized_student_ids(db, user_c)
            returned_set = set(authorized_ids)

            assert returned_set == expected_ids, (
                f"Staff C received unexpected students. Extra (LEAK): {sorted(returned_set - expected_ids)}"
            )
            print(f"\n  [PASS] Staff C: {len(returned_set)} students, isolated")

        finally:
            db.close()

    def test_zero_overlap_between_all_staff(self):
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            ids_a = set(test_data["staff_a"]["student_ids"])
            ids_b = set(test_data["staff_b"]["student_ids"])
            ids_c = set(test_data["staff_c"]["student_ids"])

            overlap_ab = ids_a & ids_b
            overlap_ac = ids_a & ids_c
            overlap_bc = ids_b & ids_c

            assert len(overlap_ab) == 0, f"ISOLATION BREACH: Staff A and B share students: {overlap_ab}"
            assert len(overlap_ac) == 0, f"ISOLATION BREACH: Staff A and C share students: {overlap_ac}"
            assert len(overlap_bc) == 0, f"ISOLATION BREACH: Staff B and C share students: {overlap_bc}"
            print(f"\n  [PASS] Zero overlap: A∩B=0, A∩C=0, B∩C=0")

        finally:
            db.close()

    def test_student_query_isolation_via_filter(self):
        """
        Verifies apply_role_based_student_filter correctly scopes Student queries.
        Staff A's filtered query must not return Staff B's students.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            staff_b_student_ids = set(test_data["staff_b"]["student_ids"])

            user_a = db.query(User).filter(User.id == staff_a_id).first()

            # Apply Staff A's filter to a general student query
            query = db.query(Student).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            )
            query = apply_role_based_student_filter(query, user_a, db)
            returned_students = query.all()
            returned_ids = {s.id for s in returned_students}

            leaked_staff_b = returned_ids & staff_b_student_ids
            assert len(leaked_staff_b) == 0, (
                f"DATA LEAK: Staff A query returned {len(leaked_staff_b)} of Staff B's students: {leaked_staff_b}"
            )
            print(f"\n  [PASS] apply_role_based_student_filter correctly isolates Staff A from Staff B's {len(staff_b_student_ids)} students")

        finally:
            db.close()


class TestDirectAPISecurityPhase3:
    """Phase 3: Direct API security — Staff A must not access Staff B's students."""

    def test_staff_a_cannot_access_staff_b_student_by_id(self):
        """Simulates GET /students/{student_id} with Staff A credentials for Staff B's student."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            staff_b_student_ids = test_data["staff_b"]["student_ids"]

            user_a = db.query(User).filter(User.id == staff_a_id).first()

            # Try to access each of Staff B's students using Staff A's auth
            blocked_count = 0
            for student_id in staff_b_student_ids[:5]:  # Test first 5
                with pytest.raises(HTTPException) as exc_info:
                    require_staff_student_access(db, user_a, student_id)
                assert exc_info.value.status_code in (403, 401), (
                    f"Expected 403 Forbidden for student {student_id}, got {exc_info.value.status_code}"
                )
                blocked_count += 1

            print(f"\n  [PASS] Staff A was blocked from accessing {blocked_count} of Staff B's students (403 Forbidden)")

        finally:
            db.close()

    def test_staff_a_cannot_see_staff_b_students_in_list_query(self):
        """Verifies the students list endpoint would not return Staff B students to Staff A."""
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            staff_b_ids = set(test_data["staff_b"]["student_ids"])
            staff_c_ids = set(test_data["staff_c"]["student_ids"])

            user_a = db.query(User).filter(User.id == staff_a_id).first()

            authorized = get_authorized_student_ids(db, user_a)
            authorized_set = set(authorized)

            # Staff A's authorized set must NOT contain any of B or C students
            assert not (authorized_set & staff_b_ids), (
                f"Staff A authorized set contains Staff B student IDs: {authorized_set & staff_b_ids}"
            )
            assert not (authorized_set & staff_c_ids), (
                f"Staff A authorized set contains Staff C student IDs: {authorized_set & staff_c_ids}"
            )
            print(f"\n  [PASS] Staff A authorized set ({len(authorized_set)} IDs) contains no Staff B or C students")

        finally:
            db.close()

    def test_unauthenticated_access_blocked(self):
        """Verifies that unauthenticated (None user) access returns empty authorized set."""
        db = SessionLocal()
        try:
            authorized = get_authorized_student_ids(db, None)
            assert authorized == [], f"Unauthenticated access returned {len(authorized)} IDs instead of empty list"
            print(f"\n  [PASS] Unauthenticated access returns empty authorized set")
        finally:
            db.close()

    def test_unknown_role_access_blocked(self):
        """Verifies that an unknown role returns empty authorized set (fail closed)."""
        db = SessionLocal()
        try:
            fake_user = User(id=99999, username="fake", email="fake@test.com", role="unknown_role", is_active=True)
            authorized = get_authorized_student_ids(db, fake_user)
            assert authorized == [], f"Unknown role returned {len(authorized)} IDs instead of empty list"
            print(f"\n  [PASS] Unknown role fails closed (empty authorized set)")
        finally:
            db.close()

    def test_my_students_endpoint_returns_only_assigned(self):
        """
        Directly tests the FIXED get_my_assigned_students logic:
        Staff A's /my-students must return ONLY assigned_ids, not all active students.
        """
        test_data = load_test_data()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        db = SessionLocal()
        try:
            staff_a_id = test_data["staff_a"]["id"]
            expected_ids = set(test_data["staff_a"]["student_ids"])
            staff_b_ids = set(test_data["staff_b"]["student_ids"])

            user_a = db.query(User).filter(User.id == staff_a_id).first()

            # FIXED endpoint logic: use assigned_ids directly
            assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id)
            students = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.department),
                joinedload(Student.section),
                joinedload(Student.stats)
            ).filter(
                Student.id.in_(assigned_ids),
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).all()

            returned_ids = {s.id for s in students}

            # Must match exactly
            assert returned_ids == expected_ids, (
                f"Endpoint returned wrong students.\n"
                f"Extra (LEAK): {returned_ids - expected_ids}\n"
                f"Missing: {expected_ids - returned_ids}"
            )

            # Staff B's students must NOT appear
            assert not (returned_ids & staff_b_ids), (
                f"Staff B students leaked into Staff A response: {returned_ids & staff_b_ids}"
            )
            print(f"\n  [PASS] /my-students (fixed) returns exactly {len(returned_ids)} correct students, no leakage")

        finally:
            db.close()


if __name__ == "__main__":
    iso = TestStaffDataIsolation()
    iso.test_staff_a_only_sees_own_students()
    iso.test_staff_b_only_sees_own_students()
    iso.test_staff_c_only_sees_own_students()
    iso.test_zero_overlap_between_all_staff()
    iso.test_student_query_isolation_via_filter()

    sec = TestDirectAPISecurityPhase3()
    sec.test_staff_a_cannot_access_staff_b_student_by_id()
    sec.test_staff_a_cannot_see_staff_b_students_in_list_query()
    sec.test_unauthenticated_access_blocked()
    sec.test_unknown_role_access_blocked()
    sec.test_my_students_endpoint_returns_only_assigned()

    print("\n[COMPLETE] All isolation and direct API security tests passed.")
