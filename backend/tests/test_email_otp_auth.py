import pytest
import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import User, Student, Department, EmailOTPRecord, AdminAuditLog
from backend.services.otp_service import (
    generate_secure_otp,
    hash_otp,
    hash_email,
    create_otp_transaction,
    verify_otp_transaction
)

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    from backend.database import run_migrations
    run_migrations()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed test department
        dept = db.query(Department).filter(Department.code == "CSE_TEST").first()
        if not dept:
            dept = Department(name="Computer Science Test", code="CSE_TEST")
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Seed active student user
        test_student_email = "teststudent_otp@nandhaengg.org"
        student = db.query(Student).filter(Student.email == test_student_email).first()
        if not student:
            student = Student(
                reg_no="732224TEST01",
                name="OTP Test Student",
                department_id=dept.id,
                year_level="III",
                email=test_student_email,
                is_active=True
            )
            db.add(student)
            db.commit()

        # Seed inactive user
        inactive_email = "inactive_user@nandhaengg.org"
        inactive_user = db.query(User).filter(User.email == inactive_email).first()
        if not inactive_user:
            inactive_user = User(
                username="inactive_user",
                email=inactive_email,
                hashed_password="hashedpassword",
                role="Student",
                is_active=False
            )
            db.add(inactive_user)
            db.commit()

        yield db
    finally:
        db.close()


def test_01_otp_generation_is_numeric_6_digits():
    otp = generate_secure_otp()
    assert len(otp) == 6
    assert otp.isdigit()
    assert 100000 <= int(otp) <= 999999


def test_02_otp_hashing_and_never_plaintext(db_session: Session):
    email = "security_test@nandhaengg.org"
    plain_otp, record = create_otp_transaction(db_session, email)

    assert plain_otp != record.otp_hash
    assert len(str(record.otp_hash)) == 64  # SHA-256 hex length
    assert record.email == email.lower().strip()
    assert record.used is False
    assert record.attempt_count == 0


def test_03_send_otp_api_valid_email(db_session: Session):
    res = client.post("/api/auth/send-otp", json={"email": "teststudent_otp@nandhaengg.org"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "message" in data
    assert "otp" not in data  # NEVER return plaintext OTP in API
    assert "plain_otp" not in data


def test_04_send_otp_api_invalid_email():
    res = client.post("/api/auth/send-otp", json={"email": "invalidemailformat"})
    assert res.status_code == 400
    assert "valid" in res.json()["detail"].lower()


def test_05_send_otp_api_inactive_account(db_session: Session):
    res = client.post("/api/auth/send-otp", json={"email": "inactive_user@nandhaengg.org"})
    assert res.status_code == 400
    assert "inactive" in res.json()["detail"].lower()


def test_06_verify_otp_api_success(db_session: Session):
    email = "teststudent_otp@nandhaengg.org"
    plain_otp, record = create_otp_transaction(db_session, email, bypass_cooldown=True)

    res = client.post("/api/auth/verify-otp", json={"email": email, "otp": plain_otp})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email

    # Verify single-use flag is updated in DB
    db_session.refresh(record)
    assert record.used is True


def test_07_verify_otp_single_use_rejection(db_session: Session):
    email = "teststudent_otp@nandhaengg.org"
    plain_otp, record = create_otp_transaction(db_session, email, bypass_cooldown=True)

    # First verification succeeds
    res1 = client.post("/api/auth/verify-otp", json={"email": email, "otp": plain_otp})
    assert res1.status_code == 200

    # Second verification with same OTP fails
    res2 = client.post("/api/auth/verify-otp", json={"email": email, "otp": plain_otp})
    assert res2.status_code == 400


def test_08_verify_otp_incorrect_code_increments_attempts(db_session: Session):
    email = "attempt_test@nandhaengg.org"
    plain_otp, record = create_otp_transaction(db_session, email)

    res = client.post("/api/auth/verify-otp", json={"email": email, "otp": "000000"})
    assert res.status_code == 400
    assert "Invalid" in res.json()["detail"]

    db_session.refresh(record)
    assert record.attempt_count == 1


def test_09_verify_otp_5_failed_attempts_locks_otp(db_session: Session):
    email = "lockout_test@nandhaengg.org"
    plain_otp, record = create_otp_transaction(db_session, email)

    for i in range(5):
        client.post("/api/auth/verify-otp", json={"email": email, "otp": "999999"})

    db_session.refresh(record)
    assert record.attempt_count >= 5
    assert record.used is True


def test_10_resend_cooldown_enforcement(db_session: Session):
    email = "cooldown_test@nandhaengg.org"
    create_otp_transaction(db_session, email)

    # Immediate second request should trigger resend cooldown ValueError
    with pytest.raises(ValueError) as excinfo:
        create_otp_transaction(db_session, email)
    assert "wait" in str(excinfo.value).lower()


def test_11_audit_logs_recorded(db_session: Session):
    audit_logs = db_session.query(AdminAuditLog).filter(
        AdminAuditLog.action_type == "SECURITY"
    ).all()
    assert len(audit_logs) > 0
    actions = [log.action for log in audit_logs]
    assert any("OTP" in a for a in actions)


def test_12_contest_data_integrity_regression(db_session: Session):
    """Verifies that OTP authentication operations cause ZERO changes to authentic contest data."""
    from backend.models import WeeklySession, WeeklyPublicResult, OfficialWeeklySnapshot
    
    sessions_cnt = db_session.query(WeeklySession).count()
    results_cnt = db_session.query(WeeklyPublicResult).count()
    snapshots_cnt = db_session.query(OfficialWeeklySnapshot).count()
    students_cnt = db_session.query(Student).count()

    # Perform an OTP verification workflow
    email = "teststudent_otp@nandhaengg.org"
    plain_otp, _ = create_otp_transaction(db_session, email, bypass_cooldown=True)
    res = client.post("/api/auth/verify-otp", json={"email": email, "otp": plain_otp})
    assert res.status_code == 200

    # Assert row counts remain 100% identical (BEFORE == AFTER)
    assert db_session.query(WeeklySession).count() == sessions_cnt
    assert db_session.query(WeeklyPublicResult).count() == results_cnt
    assert db_session.query(OfficialWeeklySnapshot).count() == snapshots_cnt
    assert db_session.query(Student).count() == students_cnt

