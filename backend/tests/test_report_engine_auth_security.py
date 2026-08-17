import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, Student
from backend.routes.auth import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def admin_headers(db_session):
    admin = db_session.query(User).filter(User.role.in_(["admin", "super admin", "Admin"])).first()
    if not admin:
        admin = User(
            username="test_admin_user_sec",
            email="test_admin_user_sec@nandha.edu.in",
            hashed_password=get_password_hash("admin123"),
            role="Admin",
            is_active=True
        )
        db_session.add(admin)
        db_session.commit()
    token = create_access_token({"sub": admin.username, "role": admin.role})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def student_user_headers(db_session):
    student_user = db_session.query(User).filter(User.role == "student").first()
    if not student_user:
        student_user = User(
            username="sec_test_student_user_2",
            email="sec_test_student_user_2@nandha.edu.in",
            hashed_password=get_password_hash("student123"),
            role="student",
            is_active=True
        )
        db_session.add(student_user)
        db_session.commit()
    token = create_access_token({"sub": student_user.username, "role": "student"})
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# 1-3. AUTHENTICATION & AUTHORIZATION TESTS
# ============================================================================

def test_unauthenticated_report_request_returns_401():
    response = client.post("/api/reports/generate", json={"report_type": "STUDENT_PERFORMANCE"})
    assert response.status_code == 401
    assert "detail" in response.json()
    assert "Authentication required" in response.json()["detail"]

def test_unauthenticated_export_excel_returns_401():
    response = client.get("/api/reports/export-excel")
    assert response.status_code == 401

def test_unauthenticated_export_pdf_returns_401():
    response = client.get("/api/reports/export-pdf")
    assert response.status_code == 401

def test_unauthorized_admin_endpoint_returns_403(student_user_headers):
    response = client.post("/api/reports/trigger-public-contest-workflow", headers=student_user_headers)
    assert response.status_code == 403

def test_authorized_report_request_returns_200(admin_headers):
    response = client.post("/api/reports/generate", json={"report_type": "STUDENT_PERFORMANCE"}, headers=admin_headers)
    assert response.status_code == 200

# ============================================================================
# 4-8. EXPORTER AUTHORIZED ENDPOINT TESTS
# ============================================================================

def test_excel_generation_authorized(admin_headers):
    response = client.get("/api/reports/5/excel", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 1000

def test_pdf_generation_authorized(admin_headers):
    response = client.get("/api/reports/export-pdf", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 1000

def test_docx_generation_authorized(admin_headers):
    response = client.get("/api/reports/export-word", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert len(response.content) > 1000

def test_csv_generation_authorized(admin_headers):
    response = client.get("/api/reports/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert len(response.content) > 100

def test_preview_generation_authorized(admin_headers):
    response = client.get("/api/reports/5/preview", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "rows" in data

def test_invalid_report_parameters_handling(admin_headers):
    response = client.post("/api/reports/generate", json={"report_type": 12345}, headers=admin_headers)
    assert response.status_code in (422, 400, 200)

# ============================================================================
# 10-16. FILTER & ROSTER INTEGRITY TESTS
# ============================================================================

def test_ii_year_filter(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix?year=II", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    for r in data["rows"]:
        assert r["year"] == "II"
    assert len(data["rows"]) == 130

def test_iii_year_filter(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix?year=III", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    for r in data["rows"]:
        assert r["year"] == "III"
    assert len(data["rows"]) == 117

def test_iv_year_filter(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix?year=IV", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    for r in data["rows"]:
        assert r["year"] == "IV"
    assert len(data["rows"]) == 55

def test_all_departments_reconciliation(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["rows"]) == 302

def test_cse_cs_department(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix?dept=CSE(CS)", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["rows"]) == 161

def test_cse_iot_department(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix?dept=CSE(IOT)", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["rows"]) == 141

def test_no_i_year_option_in_active_batches(db_session):
    i_year_students = db_session.query(Student).filter(Student.year_level == "I").count()
    assert i_year_students == 0

def test_roster_reconciliation_302(db_session):
    total = db_session.query(Student).count()
    assert total == 302

def test_public_virtual_separation(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix", headers=admin_headers)
    assert res.status_code == 200
    metrics = res.json()["metrics"]
    assert metrics["virtualAttended"] == 0
    assert metrics["publicAttended"] == 124

def test_unknown_preservation(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix", headers=admin_headers)
    assert res.status_code == 200
    metrics = res.json()["metrics"]
    assert metrics.get("unknown") in (57, 59)

def test_not_attended_preservation(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix", headers=admin_headers)
    assert res.status_code == 200
    metrics = res.json()["metrics"]
    assert metrics["notAttended"] == 119

def test_no_unknown_to_zero_conversion(admin_headers):
    res = client.get("/api/contests/sessions/5/matrix", headers=admin_headers)
    assert res.status_code == 200
    rows = res.json()["rows"]
    for r in rows:
        if r["participation_status"] == "UNKNOWN":
            assert r["total_solved"] == "—"
            assert r["score_display"] == "Data Unavailable"
