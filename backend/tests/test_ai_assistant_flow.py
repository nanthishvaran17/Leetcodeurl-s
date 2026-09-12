import pytest
import datetime
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db, SessionLocal
from backend.models import User, Department, Student, LeetCodeProfileStats, LeetCodeLanguageStats
from backend.security import get_current_user_optional
from backend.services.ai_conversation_state import ConversationStateManager

client = TestClient(app)

@pytest.fixture
def test_data():
    """Sets up minimal test data in SQLite for AI assistant testing."""
    db_session = SessionLocal()
    try:
        # Ensure department
        dept = db_session.query(Department).filter_by(code="CSE(CS)").first()
        if not dept:
            dept = Department(name="Cyber Security", code="CSE(CS)")
            db_session.add(dept)
            db_session.flush()

        # Ensure student
        student = db_session.query(Student).filter_by(reg_no="732224CC031").first()
        if not student:
            student = Student(
                reg_no="732224CC031",
                name="NANTHISH S",
                department_id=dept.id,
                year_level="III",
                section="A",
                username="nanthish17",
                is_active=True
            )
            db_session.add(student)
            db_session.flush()

            stats = LeetCodeProfileStats(
                student_id=student.id,
                total_solved=184,
                easy_solved=100,
                medium_solved=70,
                hard_solved=14,
                contest_rating=1550.0,
                sync_status="success",
                last_successful_sync=datetime.datetime.now(datetime.timezone.utc)
            )
            db_session.add(stats)

            lang_stat = LeetCodeLanguageStats(
                student_id=student.id,
                language_name="Java",
                problems_solved=184
            )
            db_session.add(lang_stat)
            db_session.commit()

        # Ensure admin user
        admin_user = db_session.query(User).filter_by(username="test_admin").first()
        if not admin_user:
            admin_user = User(
                username="test_admin",
                email="admin@nandhaengg.org",
                hashed_password="hashed_admin_pass",
                role="ADMINISTRATOR"
            )
            db_session.add(admin_user)
            db_session.commit()

        def override_user():
            return admin_user

        app.dependency_overrides[get_current_user_optional] = override_user
        yield {"dept": dept, "student": student, "admin": admin_user}
    finally:
        app.dependency_overrides.clear()
        db_session.close()


def test_casual_conversation_greeting(test_data):
    """Verify casual greeting receives natural response without triggering monitoring count fallback."""
    res = client.post("/api/ai/chat", json={
        "message": "hi",
        "conversation_id": "test_conv_greet"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "answer"
    msg = data["message"].lower()
    assert "monitoring" not in msg or "378" not in msg
    assert "hello" in msg or "help" in msg or "welcome" in msg or "hi" in msg


def test_java_pdf_top_student_flow(test_data):
    """
    CRITICAL TEST CASE:
    1. 'give me java pdf for top student' -> PDF generation for top Java student
    2. 'ok give it' -> Returns same generated PDF artifact
    3. 'yes' -> Resolves to confirmation of generated artifact
    """
    conv_id = "test_conv_java_pdf_flow"
    ConversationStateManager.clear(conv_id)

    # TURN 1: 'give me java pdf for top student'
    res1 = client.post("/api/ai/chat", json={
        "message": "give me java pdf for top student",
        "conversation_id": conv_id
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1.get("pdfAvailable") is True
    assert data1.get("downloadUrl") is not None
    assert "/api/reports/export/summary-pdf" in data1["downloadUrl"]
    assert "monitoring 378 active students" not in data1["message"].lower()

    state = ConversationStateManager.get_state(conv_id)
    assert state.generated_artifact is not None

    # TURN 2: 'ok give it'
    res2 = client.post("/api/ai/chat", json={
        "message": "ok give it",
        "conversation_id": conv_id
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2.get("pdfAvailable") is True
    assert data2.get("downloadUrl") == data1.get("downloadUrl")
    assert "monitoring 378 active students" not in data2["message"].lower()

    # TURN 3: 'yes'
    res3 = client.post("/api/ai/chat", json={
        "message": "yes",
        "conversation_id": conv_id
    })
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3.get("pdfAvailable") is True
    assert data3.get("downloadUrl") == data1.get("downloadUrl")


def test_pdf_endpoint_export(test_data):
    """Verify /api/reports/export/summary-pdf generates downloadable PDF binary."""
    res = client.get("/api/reports/export/summary-pdf?language=Java")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 100
