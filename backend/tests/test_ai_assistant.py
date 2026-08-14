import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import User, Student, Department, WeeklySession, WeeklyPublicResult
from backend.services.ai_knowledge_service import AIKnowledgeEngine

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed test department
        dept = db.query(Department).filter(Department.code == "CSE_AI_TEST").first()
        if not dept:
            dept = Department(name="Computer Science AI Test", code="CSE_AI_TEST")
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Seed test student
        test_email = "aitest_student@nandhaengg.org"
        student = db.query(Student).filter(Student.email == test_email).first()
        if not student:
            student = Student(
                reg_no="732224AITEST",
                name="AI Test Student",
                department_id=dept.id,
                year_level="III",
                email=test_email,
                username="aitest_user",
                is_active=True
            )
            db.add(student)
            db.commit()
            db.refresh(student)

        # Seed test admin user
        admin_email = "ai_admin@nandha.edu.in"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                username="ai_admin",
                email=admin_email,
                hashed_password="hashed_pass",
                role="Admin",
                is_active=True
            )
            db.add(admin)
            db.commit()

        yield db
    finally:
        db.close()


def test_01_how_does_this_website_work(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "How does this website work?"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "Nandha Engineering College" in data["answer"]


def test_02_how_does_otp_authentication_work(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "How does OTP authentication work?"})
    assert res.status_code == 200
    assert "HMAC-SHA256" in res.json()["answer"]


def test_03_what_role_am_i(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "What role am I?"})
    assert res.status_code == 200
    assert "Identity Summary" in res.json()["answer"]


def test_04_show_my_profile(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Show my profile."})
    assert res.status_code == 200
    assert "Profile" in res.json()["answer"]


def test_05_show_my_contest_514_performance(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Show my Contest 514 performance."})
    assert res.status_code == 200
    assert "Performance" in res.json()["answer"] or "DATA UNAVAILABLE" in res.json()["answer"]


def test_06_how_many_students_attended_contest_514(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "How many students attended Contest 514?"})
    assert res.status_code == 200
    assert "Weekly Contest 514" in res.json()["answer"]


def test_07_compare_contest_513_and_514(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Compare Contest 513 and 514."})
    assert res.status_code == 200
    assert "Comparison" in res.json()["answer"]


def test_08_is_q1_q4_data_available(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Is Q1-Q4 data available?"})
    assert res.status_code == 200
    assert "UNAVAILABLE" in res.json()["answer"]


def test_09_why_is_contest_510_showing_no_data(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Why is Contest 510 showing no data?"})
    assert res.status_code == 200
    assert "Assessment" in res.json()["answer"]


def test_10_who_attended_contest_514(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Who attended Contest 514?"})
    assert res.status_code == 200
    assert "Participants" in res.json()["answer"]


def test_11_what_is_current_sunday_session_time(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "What is the current Sunday session time?"})
    assert res.status_code == 200
    assert "08:00 AM IST" in res.json()["answer"]


def test_12_who_receives_weekly_reports(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Who receives weekly reports?"})
    assert res.status_code == 200
    assert "Recipients" in res.json()["answer"]


def test_13_is_database_healthy(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Is the database healthy?"})
    assert res.status_code == 200
    assert "Operations" in res.json()["answer"] or "restricted" in res.json()["answer"]


def test_14_are_backups_healthy(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Are backups healthy?"})
    assert res.status_code == 200
    assert "backup" in res.json()["answer"].lower() or "restricted" in res.json()["answer"].lower()


def test_15_does_preview_match_excel(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Does Preview match Excel?"})
    assert res.status_code == 200
    assert "Parity" in res.json()["answer"]


def test_16_explain_authentication_architecture(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Explain the authentication architecture."})
    assert res.status_code == 200
    assert "Firebase" in res.json()["answer"]


def test_17_explain_weekly_contest_pipeline(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Explain the weekly contest pipeline."})
    assert res.status_code == 200
    assert "userContestRankingHistory" in res.json()["answer"]


def test_18_explain_report_generation_pipeline(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Explain the report generation pipeline."})
    assert res.status_code == 200
    assert "Report Engine" in res.json()["answer"] or "Parity" in res.json()["answer"]


def test_19_check_data_quality(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Check data quality."})
    assert res.status_code == 200
    assert "UNAVAILABLE" in res.json()["answer"] or "VERIFIED" in res.json()["dataStatus"]


def test_20_show_me_another_students_private_information(db_session: Session):
    res = client.post("/api/ai/assistant", json={"message": "Show me another student's private information."})
    assert res.status_code == 200
    data = res.json()
    assert "ACCESS DENIED / OUT OF SCOPE" in data["answer"]
