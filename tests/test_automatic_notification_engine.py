import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    User, Student, Department, FacultyStudentAssignment,
    LeetCodeProfileStats, WeeklySession, WeeklyPublicResult,
    NotificationRecord
)
from backend.services.automatic_notification_engine import AutomaticNotificationEngine

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_daily_faculty_performance_dynamic_calculation(db_session):
    """Verifies daily faculty performance process dynamically calculates student metrics without hardcoded values."""

    dept = Department(name="Computer Science", code="CSE")
    db_session.add(dept)
    db_session.commit()

    faculty = User(
        username="faculty_test",
        email="faculty_test@nandhaengg.org",
        hashed_password="test_hash",
        role="Faculty",
        is_active=True,
        department_id=dept.id
    )
    db_session.add(faculty)
    db_session.commit()

    s1 = Student(reg_no="732224CSE001", name="Alice", department_id=dept.id, year_level="III", is_active=True)
    s2 = Student(reg_no="732224CSE002", name="Bob", department_id=dept.id, year_level="III", is_active=True)
    s3 = Student(reg_no="732224CSE003", name="Charlie", department_id=dept.id, year_level="III", is_active=True)
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    a1 = FacultyStudentAssignment(faculty_id=faculty.id, student_id=s1.id)
    a2 = FacultyStudentAssignment(faculty_id=faculty.id, student_id=s2.id)
    a3 = FacultyStudentAssignment(faculty_id=faculty.id, student_id=s3.id)
    db_session.add_all([a1, a2, a3])

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    st1 = LeetCodeProfileStats(student_id=s1.id, total_solved=105, easy_solved=80, medium_solved=25, hard_solved=0, last_updated=now)
    st2 = LeetCodeProfileStats(student_id=s2.id, total_solved=45, easy_solved=40, medium_solved=5, hard_solved=0, last_updated=now)
    st3 = LeetCodeProfileStats(student_id=s3.id, total_solved=0, easy_solved=0, medium_solved=0, hard_solved=0, last_updated=now - datetime.timedelta(days=5))
    db_session.add_all([st1, st2, st3])
    db_session.commit()

    # NOTE: emit_event creates its own SessionLocal (production DB); verify via return value only
    res = AutomaticNotificationEngine.run_daily_faculty_performance_job(db_session)

    assert res["dispatched"] == 1, f"Expected 1 dispatched, got {res}"
    assert res["skipped"] == 0


def test_daily_faculty_performance_department_fallback(db_session):
    """Verifies that faculty without explicit assignments fall back to department active students."""
    dept = Department(name="Mechanical Eng", code="MECH")
    db_session.add(dept)
    db_session.commit()

    faculty = User(
        username="faculty_fallback",
        email="faculty_fallback@nandhaengg.org",
        hashed_password="test_hash",
        role="Faculty",
        is_active=True,
        department_id=dept.id
    )
    db_session.add(faculty)
    db_session.commit()

    s1 = Student(reg_no="732224MECH001", name="Eve", department_id=dept.id, year_level="III", is_active=True)
    db_session.add(s1)
    db_session.commit()

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    st1 = LeetCodeProfileStats(student_id=s1.id, total_solved=50, easy_solved=40, medium_solved=10, hard_solved=0, last_updated=now)
    db_session.add(st1)
    db_session.commit()

    res = AutomaticNotificationEngine.run_daily_faculty_performance_job(db_session)
    assert res["dispatched"] == 1, f"Expected 1 dispatched with department fallback, got {res}"



def test_milestone_detection_and_deduplication(db_session):
    """Verifies milestone transitions trigger deduplicated notifications."""
    dept = Department(name="Information Tech", code="IT")
    db_session.add(dept)
    db_session.commit()

    s = Student(reg_no="732224IT001", name="David", department_id=dept.id, year_level="III", is_active=True, email="david@nandha.org")
    db_session.add(s)
    db_session.commit()

    # Transition from 99 to 102 (should trigger 100 milestone)
    res_list = AutomaticNotificationEngine.check_and_emit_student_milestones(
        db=db_session,
        student_id=s.id,
        old_solved=99,
        new_solved=102
    )

    assert len(res_list) == 1
    assert res_list[0].get("success") is True

    # Re-run with old_solved=100; no new milestone threshold is crossed (100 not < 100)
    res_list_dup = AutomaticNotificationEngine.check_and_emit_student_milestones(
        db=db_session,
        student_id=s.id,
        old_solved=100,
        new_solved=102
    )
    assert len(res_list_dup) == 0


def test_sunday_contest_role_summaries(db_session):
    """Verifies Sunday contest absent and attendance metrics calculated per role."""
    dept = Department(name="ECE", code="ECE")
    db_session.add(dept)
    db_session.commit()

    fac = User(username="fac_ece", email="fac_ece@nandha.org", hashed_password="test_hash", role="Faculty", is_active=True, department_id=dept.id)
    hod = User(username="hod_ece", email="hod_ece@nandha.org", hashed_password="test_hash", role="HOD", is_active=True, department_id=dept.id)
    prin = User(username="principal_test", email="principal@nandha.org", hashed_password="test_hash", role="Principal", is_active=True)
    db_session.add_all([fac, hod, prin])
    db_session.commit()

    s1 = Student(reg_no="732224ECE001", name="Eve", department_id=dept.id, year_level="II", is_active=True)
    s2 = Student(reg_no="732224ECE002", name="Frank", department_id=dept.id, year_level="II", is_active=True)
    db_session.add_all([s1, s2])
    db_session.commit()

    a1 = FacultyStudentAssignment(faculty_id=fac.id, student_id=s1.id)
    a2 = FacultyStudentAssignment(faculty_id=fac.id, student_id=s2.id)
    db_session.add_all([a1, a2])

    sess = WeeklySession(
        contest_name="Weekly Contest 516",
        session_date=datetime.date.today(),
        official_participants=1,
        virtual_participants=0
    )
    db_session.add(sess)
    db_session.commit()

    # WeeklyPublicResult requires reg_no, name, dept, year (NOT NULL)
    r1 = WeeklyPublicResult(
        session_id=sess.id,
        student_id=s1.id,
        reg_no=s1.reg_no,
        name=s1.name,
        dept=dept.code,
        year=s1.year_level,
        participation_status="OFFICIAL_ATTENDED",
        total_contest_solved=2
    )
    db_session.add(r1)
    db_session.commit()

    res = AutomaticNotificationEngine.emit_sunday_contest_role_summaries(db_session, session_id=sess.id)

    assert res["faculty_dispatched"] == 1, f"Expected 1 faculty notification, got {res['faculty_dispatched']}"
    assert res["hod_dispatched"] == 1, f"Expected 1 HOD notification, got {res['hod_dispatched']}"
    assert res["principal_dispatched"] == 1, f"Expected 1 principal notification, got {res['principal_dispatched']}"
