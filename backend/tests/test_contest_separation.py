import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Department, Student, LeetCodeProfileStats
from backend.services.contest_service import (
    record_contest_participation,
    get_student_contest_records,
    build_student_contest_dto
)

# Setup in-memory SQLite database for test suite
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test department & student
    dept = Department(name="Computer Science & Engineering", code="CSE")
    db.add(dept)
    db.commit()
    db.refresh(dept)

    student = Student(
        reg_no="732224CC001",
        name="TEST STUDENT",
        department_id=dept.id,
        year_level="III",
        username="test_student_user"
    )
    db.add(student)
    db.commit()

    stats = LeetCodeProfileStats(student_id=student.id, total_solved=150, public_profile_ranking=90000)
    db.add(stats)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_scenario_1_public_only(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    # Record Public Contest participation = 3 / 4
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="PUBLIC", questions_solved=3, questions_total=4, status="ATTENDED"
    )

    pub_rec, vir_rec = get_student_contest_records(db, student.id, "weekly-470")
    assert pub_rec is not None
    assert pub_rec.score_display == "3 / 4"
    assert vir_rec is None

    dto = build_student_contest_dto(db, student, "weekly-470")
    assert dto["public_contest_result"]["score_display"] == "3 / 4"
    assert dto["virtual_contest_result"]["score_display"] == "Not Attended"
    assert dto["overall_participation_mode"] == "PUBLIC_ONLY"


def test_scenario_2_virtual_only(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    # Record Virtual Contest participation = 2 / 4
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="VIRTUAL", questions_solved=2, questions_total=4, status="ATTENDED"
    )

    pub_rec, vir_rec = get_student_contest_records(db, student.id, "weekly-470")
    assert pub_rec is None
    assert vir_rec is not None
    assert vir_rec.score_display == "2 / 4"

    dto = build_student_contest_dto(db, student, "weekly-470")
    assert dto["public_contest_result"]["score_display"] == "Not Attended"
    assert dto["virtual_contest_result"]["score_display"] == "2 / 4"
    assert dto["overall_participation_mode"] == "VIRTUAL_ONLY"


def test_scenario_3_both_participated(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    # Record both Public = 3/4 and Virtual = 2/4
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="PUBLIC", questions_solved=3, questions_total=4, status="ATTENDED"
    )

    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="VIRTUAL", questions_solved=2, questions_total=4, status="ATTENDED"
    )

    pub_rec, vir_rec = get_student_contest_records(db, student.id, "weekly-470")
    assert pub_rec.score_display == "3 / 4"
    assert vir_rec.score_display == "2 / 4"

    dto = build_student_contest_dto(db, student, "weekly-470")
    assert dto["public_contest_result"]["score_display"] == "3 / 4"
    assert dto["virtual_contest_result"]["score_display"] == "2 / 4"
    assert dto["overall_participation_mode"] == "BOTH"


def test_scenario_4_none(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    dto = build_student_contest_dto(db, student, "weekly-470")
    assert dto["public_contest_result"]["score_display"] == "Not Attended"
    assert dto["virtual_contest_result"]["score_display"] == "Not Attended"
    assert dto["overall_participation_mode"] == "NONE"


def test_scenario_5_fetch_failed_isolation(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    # Record Public fetch failed
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="PUBLIC", questions_solved=0, questions_total=4, status="FETCH_FAILED",
        error_message="Network timeout"
    )

    # Record Virtual = 2/4
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="VIRTUAL", questions_solved=2, questions_total=4, status="ATTENDED"
    )

    dto = build_student_contest_dto(db, student, "weekly-470")
    assert dto["public_contest_result"]["status"] == "FETCH_FAILED"
    assert dto["public_contest_result"]["score_display"] == "Fetch Failed"
    assert dto["virtual_contest_result"]["score_display"] == "2 / 4"
    assert dto["overall_participation_mode"] == "FETCH_ERROR"


def test_zero_overwrite_validation(setup_database):
    db = setup_database
    student = db.query(Student).filter(Student.reg_no == "732224CC001").first()

    # Step 1: Public = 3/4
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="PUBLIC", questions_solved=3, questions_total=4, status="ATTENDED"
    )

    # Step 2: Virtual = 1/4 (Later attempt)
    record_contest_participation(
        db=db, student_id=student.id, contest_id="weekly-470", contest_name="Weekly Contest 470",
        participation_mode="VIRTUAL", questions_solved=1, questions_total=4, status="ATTENDED"
    )

    # Verify Public remains 3/4 and was NOT overwritten to 1/4
    pub_rec, vir_rec = get_student_contest_records(db, student.id, "weekly-470")
    assert pub_rec.score_display == "3 / 4"
    assert vir_rec.score_display == "1 / 4"
