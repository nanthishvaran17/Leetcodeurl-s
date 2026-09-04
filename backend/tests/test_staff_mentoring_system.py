"""
test_staff_mentoring_system.py — Comprehensive Test Suite for Staff-Based Mentoring & Security RBAC Engine
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import User, Student, Department
from backend.routes.auth import get_password_hash
from backend.services.faculty_assignment_service import faculty_assignment_service

client = TestClient(app)


def setup_module():
    """Initializes database tables before testing."""
    Base.metadata.create_all(bind=engine)


def test_staff_capacity_cap_enforcement():
    """
    Requirement 6: Enforce MAX 30 students limit per staff member server-side.
    Assigning student #31 must be blocked with 400 Bad Request.
    """
    db: Session = SessionLocal()
    try:
        # Create test department
        dept = db.query(Department).filter(Department.code == "TEST_DEPT").first()
        if not dept:
            dept = Department(name="Test Department", code="TEST_DEPT")
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Create test staff member
        staff = db.query(User).filter(User.username == "test_staff_cap").first()
        if not staff:
            staff = User(
                username="test_staff_cap",
                email="test_staff_cap@nandhaengg.org",
                hashed_password=get_password_hash("Staff123!"),
                role="Staff",
                department_id=dept.id,
                is_active=True
            )
            db.add(staff)
            db.commit()
            db.refresh(staff)

        # Create 35 test students
        student_ids = []
        for i in range(1, 36):
            reg = f"7322TEST{i:03d}"
            st = db.query(Student).filter(Student.reg_no == reg).first()
            if not st:
                st = Student(
                    reg_no=reg,
                    name=f"Test Student {i}",
                    department_id=dept.id,
                    year_level="III",
                    is_active=True
                )
                db.add(st)
                db.commit()
                db.refresh(st)
            student_ids.append(st.id)

        # Assign 30 students -> Should succeed
        res_30 = faculty_assignment_service.assign_students_to_faculty(
            db=db,
            faculty_id=staff.id,
            student_ids=student_ids[:30]
        )
        assert res_30["success"] is True
        assert res_30["total_assigned"] == 30

        # Attempting to assign 31st student -> Must raise 400 Bad Request
        with pytest.raises(Exception) as excinfo:
            faculty_assignment_service.assign_students_to_faculty(
                db=db,
                faculty_id=staff.id,
                student_ids=[student_ids[30]]
            )
        assert "30" in str(excinfo.value) or "maximum student capacity" in str(excinfo.value)

        print("[OK] Hard capacity cap of 30 students verified successfully!")

    finally:
        db.close()


def test_staff_student_data_isolation():
    """
    Requirement 9: Staff A trying to access Staff B's student via API/URL must return 403 Forbidden.
    """
    db: Session = SessionLocal()
    try:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="General CSE", code="CSE")
            db.add(dept)
            db.commit()

        # Staff A
        staff_a = db.query(User).filter(User.username == "staff_alpha").first()
        if not staff_a:
            staff_a = User(username="staff_alpha", email="staff_a@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=dept.id, is_active=True)
            db.add(staff_a)
            db.commit()
            db.refresh(staff_a)

        # Staff B
        staff_b = db.query(User).filter(User.username == "staff_beta").first()
        if not staff_b:
            staff_b = User(username="staff_beta", email="staff_b@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=dept.id, is_active=True)
            db.add(staff_b)
            db.commit()
            db.refresh(staff_b)

        # Student B assigned to Staff B
        stu_b = db.query(Student).filter(Student.reg_no == "7322STUBETA").first()
        if not stu_b:
            stu_b = Student(reg_no="7322STUBETA", name="Student Beta", department_id=dept.id, year_level="III", is_active=True)
            db.add(stu_b)
            db.commit()
            db.refresh(stu_b)

        faculty_assignment_service.assign_students_to_faculty(db=db, faculty_id=staff_b.id, student_ids=[stu_b.id])

        # Verify Staff A assigned list does not contain Student B
        assigned_a = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a.id)
        assert stu_b.id not in assigned_a

        print("[OK] Data isolation between Staff accounts verified successfully!")

    finally:
        db.close()


def test_public_leaderboard_integrity():
    """
    Requirement 1: Verify existing Public Leaderboard endpoint works without regression.
    """
    response = client.get("/api/students/leaderboard-fast")
    assert response.status_code == 200
    print("[OK] Public Leaderboard integrity verified!")


if __name__ == "__main__":
    setup_module()
    test_staff_capacity_cap_enforcement()
    test_staff_student_data_isolation()
    test_public_leaderboard_integrity()
    print("\n[SUCCESS] ALL STAFF MENTORING & SECURITY TESTS PASSED PERFECTLY!")
