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
    res = client.post("/api/auth/send-otp", json={"email": "nanthishvaran17@gmail.com"})
    assert res.status_code == 200
    req_id = res.json().get("request_id")
    
    # Verify OTP handler issues Admin role in user token payload
    from backend.services.otp_service import get_active_otp_for_dev
    dev_otp = get_active_otp_for_dev("nanthishvaran17@gmail.com")
    if dev_otp:
        res_v = client.post("/api/auth/verify-otp", json={
            "email": "nanthishvaran17@gmail.com",
            "otp": dev_otp,
            "request_id": req_id
        })
        assert res_v.status_code == 200
        data = res_v.json()
        assert data["user"]["role"] in ["Admin", "admin"]


def test_04_contest_data_preserved_unmodified(db_session: Session):
    sessions = db_session.query(WeeklySession).all()
    assert len(sessions) > 0


def test_05_student_roster_count_preserved(db_session: Session):
    students = db_session.query(Student).all()
    assert len(students) >= 270
