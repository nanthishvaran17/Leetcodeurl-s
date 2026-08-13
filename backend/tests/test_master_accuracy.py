import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Department, Student, LeetCodeProfileStats, StudentContestParticipation, StudentStatSnapshot
from backend.services.contest_service import record_contest_participation, get_student_contest_records, calculate_overall_mode
from backend.services.live_sync_service import _process_single_student_sync

TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    dept = Department(name="Computer Science & Engineering (Cyber Security)", code="CSE(CS)")
    db.add(dept)
    db.commit()

    student = Student(
        reg_no="732224CC031",
        name="NANTHISH S",
        department_id=dept.id,
        year_level="III",
        username="nanthishvaran_07"
    )
    db.add(student)
    db.commit()

    stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=706,
        easy_solved=271,
        medium_solved=326,
        hard_solved=109,
        contest_rating=1627.0,
        contest_global_ranking=179015,
        status="verified",
        sync_status="success"
    )
    db.add(stats)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_snapshot_preservation_on_fetch_failure(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC031").first()

    # Simulate network exception / timeout on live fetch attempt
    fetch_error = Exception("HTTPSConnectionPool timeout to leetcode.com")
    is_succ, is_part, is_err = _process_single_student_sync(db, "JOB-TEST-001", student, fetch_error)

    # Verify previous snapshot metrics remain 100% preserved
    db.refresh(student.stats)
    assert student.stats.total_solved == 706
    assert student.stats.easy_solved == 271
    assert student.stats.medium_solved == 326
    assert student.stats.hard_solved == 109
    assert student.stats.sync_status == "stale"
    assert is_part is True
    assert is_err is False


def test_difficulty_sum_integrity(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC031").first()

    total = student.stats.total_solved
    easy = student.stats.easy_solved
    medium = student.stats.medium_solved
    hard = student.stats.hard_solved

    assert easy + medium + hard == total


def test_public_and_virtual_contest_isolation(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC031").first()

    # Record Public Contest attempt = 3/4
    record_contest_participation(
        db, student.id, "weekly-513", "Weekly Contest 513",
        "PUBLIC", questions_solved=3, questions_total=4, status="ATTENDED"
    )

    # Record Virtual Contest attempt = 2/4
    record_contest_participation(
        db, student.id, "weekly-513", "Weekly Contest 513",
        "VIRTUAL", questions_solved=2, questions_total=4, status="ATTENDED"
    )

    pub_rec, vir_rec = get_student_contest_records(db, student.id, "weekly-513")
    assert pub_rec.score_display == "3 / 4"
    assert vir_rec.score_display == "2 / 4"
    assert calculate_overall_mode("ATTENDED", "ATTENDED") == "BOTH"
