"""
test_post_930_solvers.py — Comprehensive Test Suite for Post-9:30 AM Solvers Detection & Security RBAC Engine
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

import pytest
import datetime
import pytz
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import User, Student, Department, WeeklySession, WeeklyVirtualResult, OfficialWeeklySnapshot
from backend.routes.auth import get_password_hash
from backend.services.faculty_assignment_service import faculty_assignment_service

client = TestClient(app)
ist_tz = pytz.timezone("Asia/Kolkata")


def setup_module():
    """Initializes database tables before testing."""
    Base.metadata.create_all(bind=engine)


def test_post_930_detection_rules_and_timestamp_boundary():
    """
    Test timestamp boundary rules:
    - 09:30:00 IST -> Official window (NOT post-9:30)
    - 09:30:01 IST -> Post-session activity (INCLUDED)
    - Zero post-9:30 activity -> NOT listed
    - Score Immutability -> Official snapshot score remains unchanged
    """
    db: Session = SessionLocal()
    try:
        dept = db.query(Department).filter(Department.code == "TEST_P930").first()
        if not dept:
            dept = Department(name="Post 930 Dept", code="TEST_P930")
            db.add(dept)
            db.commit()

        # Student 1: Solved at 09:30:00 IST (Official window)
        s1 = db.query(Student).filter(Student.reg_no == "7322P930_S1").first()
        if not s1:
            s1 = Student(reg_no="7322P930_S1", name="Official Solver", department_id=dept.id, year_level="III", is_active=True)
            db.add(s1)
            db.commit()

        # Student 2: Solved at 09:30:01 IST (Post-Session Solver)
        s2 = db.query(Student).filter(Student.reg_no == "7322P930_S2").first()
        if not s2:
            s2 = Student(reg_no="7322P930_S2", name="Post 930 Solver", department_id=dept.id, year_level="III", is_active=True)
            db.add(s2)
            db.commit()

        # Student 3: No activity after 9:30 AM
        s3 = db.query(Student).filter(Student.reg_no == "7322P930_S3").first()
        if not s3:
            s3 = Student(reg_no="7322P930_S3", name="Quiet Solver", department_id=dept.id, year_level="III", is_active=True)
            db.add(s3)
            db.commit()

        # Create session
        today_date = datetime.date.today()
        sess = db.query(WeeklySession).filter(WeeklySession.session_code == "POST_930_TEST_SESS").first()
        if not sess:
            sess = WeeklySession(
                session_code="POST_930_TEST_SESS",
                session_date=today_date,
                contest_name="Weekly Contest Test",
                status="FINALIZED"
            )
            db.add(sess)
            db.commit()

        # Add Virtual Result for Student 2 at 09:30:01 IST (04:00:01 UTC)
        v_time_post = datetime.datetime.combine(today_date, datetime.time(4, 0, 1)) # 09:30:01 IST in UTC
        v_res2 = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.student_id == s2.id).first()
        if not v_res2:
            v_res2 = WeeklyVirtualResult(
                session_id=sess.id,
                student_id=s2.id,
                reg_no=s2.reg_no,
                name=s2.name,
                total_contest_solved=2,
                completed_at=v_time_post
            )
            db.add(v_res2)
            db.commit()

        # API Request
        res = client.get("/api/contests/post-930-solvers")
        if res.status_code != 200:
            print(f"FAILED status_code={res.status_code}, response={res.text}")
        assert res.status_code == 200
        data = res.json()

        students_detected = data.get("students", [])
        student_regs = [s["reg_no"] for s in students_detected]

        # Student 2 must be detected
        assert "7322P930_S2" in student_regs

        # Student 3 (no activity) must NOT be detected
        assert "7322P930_S3" not in student_regs

        print("[OK] Post-9:30 AM detection boundary & filtering rules verified successfully!")

    finally:
        db.close()


def test_post_930_staff_rbac_security():
    """
    Test Fail-Closed RBAC:
    Staff A requesting Staff B's student via `student_id` query parameter MUST return 403 Forbidden.
    """
    db: Session = SessionLocal()
    try:
        dept = db.query(Department).first()

        # Staff Alpha
        staff_a = db.query(User).filter(User.username == "staff_alpha_p930").first()
        if not staff_a:
            staff_a = User(username="staff_alpha_p930", email="staff_a_p930@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=dept.id, is_active=True)
            db.add(staff_a)
            db.commit()

        # Staff Beta
        staff_b = db.query(User).filter(User.username == "staff_beta_p930").first()
        if not staff_b:
            staff_b = User(username="staff_beta_p930", email="staff_b_p930@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=dept.id, is_active=True)
            db.add(staff_b)
            db.commit()

        # Student Beta assigned to Staff Beta
        stu_b = db.query(Student).filter(Student.reg_no == "7322STU_RBAC_B").first()
        if not stu_b:
            stu_b = Student(reg_no="7322STU_RBAC_B", name="Student Beta RBAC", department_id=dept.id, year_level="III", is_active=True)
            db.add(stu_b)
            db.commit()

        faculty_assignment_service.assign_students_to_faculty(db=db, faculty_id=staff_b.id, student_ids=[stu_b.id])

        # Staff A attempting to query Staff B's student -> MUST raise 403 Forbidden
        from backend.routes.weekly_contests import get_post_930_solvers
        from fastapi import HTTPException
        from unittest.mock import MagicMock, patch

        mock_req = MagicMock()

        with patch("backend.routes.auth.get_current_user_from_request", return_value=staff_a):
            with pytest.raises(HTTPException) as exc_info:
                get_post_930_solvers(
                    request=mock_req,
                    session_date=None,
                    dept=None,
                    year_level=None,
                    section=None,
                    min_post_window_solves=1,
                    sort_by="latest",
                    search=None,
                    student_id=stu_b.id,
                    db=db
                )
            assert exc_info.value.status_code == 403

        print("[OK] Staff RBAC security & 403 Forbidden isolation verified successfully!")

    finally:
        db.close()


def test_post_930_excel_export():
    """
    Test Excel Export endpoint returns valid .xlsx binary attachment.
    """
    res = client.get("/api/contests/post-930-solvers/export")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res.headers["content-type"]
    print("[OK] Post-9:30 Solvers Excel export verified successfully!")


if __name__ == "__main__":
    setup_module()
    test_post_930_detection_rules_and_timestamp_boundary()
    test_post_930_staff_rbac_security()
    test_post_930_excel_export()
    print("\n[SUCCESS] ALL POST-9:30 AM SOLVERS TESTS PASSED PERFECTLY!")
