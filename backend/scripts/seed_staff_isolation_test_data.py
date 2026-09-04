"""
seed_staff_isolation_test_data.py — Phase 2: Staff Isolation Test Data

Creates:
  Staff A → 20 unique test students (IDs seeded with reg_nos TSTA001-TSTA020)
  Staff B → 20 unique test students (TSTB001-TSTB020)
  Staff C → 20 unique test students (TSTC001-TSTC020)

No overlap is permitted. Verifies isolation post-creation.
Idempotent: safe to run multiple times (cleans up previous test data first).
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import (
    User, Student, Department, FacultyStudentAssignment,
    StudentAssignmentHistory, LeetCodeProfileStats
)
import datetime

TEST_PREFIX = "TEST_ISOLATION_"
STUDENTS_PER_STAFF = 20


def clean_previous_test_data(db):
    """Removes all previously seeded isolation test data."""
    print("  Cleaning previous isolation test data...")

    # Find test staff users
    test_staff = db.query(User).filter(User.username.like(f"{TEST_PREFIX}Staff%")).all()
    staff_ids = [u.id for u in test_staff]

    if staff_ids:
        # Remove assignments
        db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id.in_(staff_ids)
        ).delete(synchronize_session=False)
        db.query(StudentAssignmentHistory).filter(
            StudentAssignmentHistory.previous_faculty_id.in_(staff_ids) |
            StudentAssignmentHistory.new_faculty_id.in_(staff_ids)
        ).delete(synchronize_session=False)
        # Remove staff users
        db.query(User).filter(User.id.in_(staff_ids)).delete(synchronize_session=False)

    # Find test students
    test_students = db.query(Student).filter(Student.reg_no.like(f"{TEST_PREFIX}%")).all()
    student_ids = [s.id for s in test_students]
    if student_ids:
        db.query(LeetCodeProfileStats).filter(
            LeetCodeProfileStats.student_id.in_(student_ids)
        ).delete(synchronize_session=False)
        db.query(Student).filter(Student.id.in_(student_ids)).delete(synchronize_session=False)

    db.commit()
    print(f"    Removed {len(test_staff)} test staff, {len(test_students)} test students")


def get_or_create_test_department(db) -> Department:
    db.rollback()  # Clear any pending state
    # Try existing test departments first
    for code in ["TEST_DEPT", "TEST", "CSE"]:
        dept = db.query(Department).filter(Department.code == code).first()
        if dept:
            return dept
    # Fall back to any department
    dept = db.query(Department).first()
    return dept


def create_test_staff(db, label: str, dept_id: int, email: str) -> User:
    staff = User(
        username=f"{TEST_PREFIX}Staff{label}",
        email=email,
        role="Staff",
        department_id=dept_id,
        is_active=True,
        hashed_password="test_hashed_password_isolation"
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


def create_test_students(db, label: str, dept_id: int, count: int) -> list:
    students = []
    for i in range(1, count + 1):
        reg_no = f"{TEST_PREFIX}{label}{i:03d}"
        student = Student(
            reg_no=reg_no,
            name=f"Test Student {label}{i:03d}",
            department_id=dept_id,
            year_level="III",
            email=f"test.{label.lower()}{i:03d}@nandha.test",
            username=f"lc_test_{label.lower()}_{i:03d}",
            is_active=True
        )
        db.add(student)
        db.flush()  # Get ID without committing

        # Add stats record
        stats = LeetCodeProfileStats(
            student_id=student.id,
            total_solved=i * 5,
            easy_solved=i * 2,
            medium_solved=i * 2,
            hard_solved=i,
            contest_rating=1200.0 + (i * 10),
            sync_status="success",
            status="verified",
            validation_status="verified"
        )
        db.add(stats)
        students.append(student)

    db.commit()
    for s in students:
        db.refresh(s)
    return students


def assign_students_to_staff(db, staff: User, students: list, admin_id: int = None):
    now = datetime.datetime.utcnow()
    for student in students:
        assignment = FacultyStudentAssignment(
            faculty_id=staff.id,
            student_id=student.id,
            assigned_by_id=admin_id,
            is_active=True,
            assigned_at=now
        )
        db.add(assignment)

        history = StudentAssignmentHistory(
            student_id=student.id,
            previous_faculty_id=None,
            new_faculty_id=staff.id,
            assigned_by_id=admin_id,
            reason="Isolation Test Seed",
            assigned_at=now
        )
        db.add(history)
    db.commit()


def verify_isolation(db, staff_a: User, staff_b: User, staff_c: User):
    """Verifies zero overlap between staff student sets."""
    from backend.services.faculty_assignment_service import faculty_assignment_service

    ids_a = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a.id))
    ids_b = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_b.id))
    ids_c = set(faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_c.id))

    overlap_ab = ids_a & ids_b
    overlap_ac = ids_a & ids_c
    overlap_bc = ids_b & ids_c

    print(f"\n  Isolation Verification:")
    print(f"    Staff A assigned: {len(ids_a)} students")
    print(f"    Staff B assigned: {len(ids_b)} students")
    print(f"    Staff C assigned: {len(ids_c)} students")
    print(f"    A∩B overlap:  {len(overlap_ab)} (expected: 0)")
    print(f"    A∩C overlap:  {len(overlap_ac)} (expected: 0)")
    print(f"    B∩C overlap:  {len(overlap_bc)} (expected: 0)")

    assert len(overlap_ab) == 0, f"ISOLATION FAILURE: Staff A and B share students: {overlap_ab}"
    assert len(overlap_ac) == 0, f"ISOLATION FAILURE: Staff A and C share students: {overlap_ac}"
    assert len(overlap_bc) == 0, f"ISOLATION FAILURE: Staff B and C share students: {overlap_bc}"
    assert len(ids_a) == STUDENTS_PER_STAFF, f"Staff A has {len(ids_a)} students, expected {STUDENTS_PER_STAFF}"
    assert len(ids_b) == STUDENTS_PER_STAFF, f"Staff B has {len(ids_b)} students, expected {STUDENTS_PER_STAFF}"
    assert len(ids_c) == STUDENTS_PER_STAFF, f"Staff C has {len(ids_c)} students, expected {STUDENTS_PER_STAFF}"

    print(f"\n  ✅ ISOLATION VERIFIED: Zero overlap. Each staff has exactly {STUDENTS_PER_STAFF} unique students.")
    return ids_a, ids_b, ids_c


def seed_and_verify():
    print("=" * 70)
    print("PHASE 2 — STAFF DATA ISOLATION TEST DATA CREATION")
    print("=" * 70)

    db = SessionLocal()
    try:
        clean_previous_test_data(db)
        dept = get_or_create_test_department(db)

        print(f"\n  Creating Staff A, B, C in department: {dept.name} (ID: {dept.id})")

        staff_a = create_test_staff(db, "A", dept.id, "test.staff.a@nandha.test")
        staff_b = create_test_staff(db, "B", dept.id, "test.staff.b@nandha.test")
        staff_c = create_test_staff(db, "C", dept.id, "test.staff.c@nandha.test")

        print(f"    Staff A: ID={staff_a.id}, username={staff_a.username}")
        print(f"    Staff B: ID={staff_b.id}, username={staff_b.username}")
        print(f"    Staff C: ID={staff_c.id}, username={staff_c.username}")

        print(f"\n  Creating {STUDENTS_PER_STAFF} students each for A, B, C...")
        students_a = create_test_students(db, "A", dept.id, STUDENTS_PER_STAFF)
        students_b = create_test_students(db, "B", dept.id, STUDENTS_PER_STAFF)
        students_c = create_test_students(db, "C", dept.id, STUDENTS_PER_STAFF)

        print(f"    Students A: IDs {students_a[0].id}–{students_a[-1].id}")
        print(f"    Students B: IDs {students_b[0].id}–{students_b[-1].id}")
        print(f"    Students C: IDs {students_c[0].id}–{students_c[-1].id}")

        print(f"\n  Assigning students to staff members...")
        assign_students_to_staff(db, staff_a, students_a)
        assign_students_to_staff(db, staff_b, students_b)
        assign_students_to_staff(db, staff_c, students_c)

        ids_a, ids_b, ids_c = verify_isolation(db, staff_a, staff_b, staff_c)

        result = {
            "staff_a": {"id": staff_a.id, "username": staff_a.username, "student_ids": list(ids_a)},
            "staff_b": {"id": staff_b.id, "username": staff_b.username, "student_ids": list(ids_b)},
            "staff_c": {"id": staff_c.id, "username": staff_c.username, "student_ids": list(ids_c)},
        }

        # Save for use in other tests
        import json
        output_path = os.path.join(os.path.dirname(__file__), "isolation_test_data.json")
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"\n  ✓ Test data saved to: {output_path}")

        return result

    finally:
        db.close()


if __name__ == "__main__":
    seed_and_verify()
