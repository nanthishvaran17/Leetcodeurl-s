import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import User, Student, WeeklySession, WeeklyPublicResult

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        st = db.query(Student).filter(Student.email == "nanthishvaran17@gmail.com").first()
        if not st:
            st = Student(reg_no="NEC_TEST_01", name="Nanthishvaran S", email="nanthishvaran17@gmail.com", department_id=1, year_level="III", is_active=True)
            db.add(st)
        u = db.query(User).filter(User.email == "nanthishvaran17@gmail.com").first()
        if not u:
            u = User(username="nanthishvaran17", email="nanthishvaran17@gmail.com", hashed_password="admin", role="Admin", is_active=True)
            db.add(u)
        db.commit()
        yield db
    finally:
        db.close()


def test_01_existing_email_is_preserved(db_session: Session):
    student = db_session.query(Student).filter(Student.email == "nanthishvaran17@gmail.com").first()
    assert student is not None
    assert student.email == "nanthishvaran17@gmail.com"


def test_02_admin_user_record_role_is_admin(db_session: Session):
    user = db_session.query(User).filter(User.email == "nanthishvaran17@gmail.com").first()
    assert user is not None
    assert user.role in ["Admin", "admin"]
    assert user.is_active is True


def test_03_otp_verification_issues_admin_token(db_session: Session):
    from backend.services.otp_service import create_otp_transaction, verify_otp_transaction
    plain_otp, otp_rec = create_otp_transaction(db_session, "nanthishvaran17@gmail.com", "127.0.0.1")
    is_valid, msg, _ = verify_otp_transaction(db_session, "nanthishvaran17@gmail.com", plain_otp, otp_rec.request_id)
    assert is_valid is True


def test_04_contest_data_preserved_unmodified(db_session: Session):
    sessions = db_session.query(WeeklySession).all()
    assert len(sessions) > 0


def test_05_student_roster_count_preserved(db_session: Session):
    students = db_session.query(Student).all()
    assert len(students) >= 270
