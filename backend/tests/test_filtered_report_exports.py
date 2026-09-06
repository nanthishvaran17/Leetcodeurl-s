import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.main import app
from backend.database import SessionLocal
from backend.models import Student, User, WeeklySession
from backend.services.report_data_service import fetch_normalized_students
from backend.services.report_engine import build_universal_report
from backend.services.report_models import ReportConfig
from backend.routes.reports import _get_dataset_for_id

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def admin_headers(db_session: Session):
    admin = db_session.query(User).filter(User.role.in_(["super admin", "admin", "Admin", "super_admin"])).first()
    if not admin:
        from backend.routes.auth import get_password_hash
        admin = User(
            username="test_admin_filtered_export",
            email="test_admin_filtered_export@nandha.edu.in",
            hashed_password=get_password_hash("admin123"),
            role="Admin",
            is_active=True
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)
    from backend.routes.auth import create_access_token
    token = create_access_token(data={"sub": admin.username, "role": admin.role, "id": admin.id})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. TEST FILTER DATA SERVICE (fetch_normalized_students)
# ==============================================================================

def test_fetch_normalized_students_unfiltered(db_session: Session):
    """Verify unfiltered returns all 318 active students."""
    all_students = fetch_normalized_students(db_session)
    assert len(all_students) == 318, f"Expected 318 students, got {len(all_students)}"


def test_fetch_normalized_students_single_dept_filter(db_session: Session):
    """Verify department filtering returns only students from that specific department."""
    cse_students = fetch_normalized_students(db_session, department="CSE(CS)")
    assert len(cse_students) > 0
    for s in cse_students:
        assert s.dept == "CSE(CS)"

    it_students = fetch_normalized_students(db_session, department="IT")
    for s in it_students:
        assert s.dept == "IT"


def test_fetch_normalized_students_academic_year_filter(db_session: Session):
    """Verify year filtering matches canonical academic years (III, II, etc.)."""
    third_years = fetch_normalized_students(db_session, year="III")
    assert len(third_years) > 0
    for s in third_years:
        assert s.year == "III"


def test_fetch_normalized_students_search_filter(db_session: Session):
    """Verify search filter filters by name, reg_no, or username."""
    sample = db_session.query(Student).filter(Student.is_active == True).first()
    assert sample is not None

    by_reg = fetch_normalized_students(db_session, searchQuery=sample.reg_no)
    assert len(by_reg) >= 1
    assert any(s.reg_no == sample.reg_no for s in by_reg)

    if sample.username:
        by_user = fetch_normalized_students(db_session, searchQuery=sample.username)
        assert len(by_user) >= 1
        assert any(s.username == sample.username for s in by_user)


def test_fetch_normalized_students_multi_filter(db_session: Session):
    """Verify combined Department + Year filter."""
    filtered = fetch_normalized_students(db_session, department="CSE(CS)", year="III")
    assert len(filtered) > 0
    for s in filtered:
        assert s.dept == "CSE(CS)"
        assert s.year == "III"


def test_fetch_normalized_students_empty_result(db_session: Session):
    """Verify non-matching filter combination returns empty list without error or fallback."""
    empty = fetch_normalized_students(db_session, department="NON_EXISTENT_DEPT", searchQuery="XYZ99999999")
    assert len(empty) == 0


# ==============================================================================
# 2. TEST REPORT ENGINE WITH FILTERS (build_universal_report)
# ==============================================================================

def test_build_universal_report_filters_match_metrics(db_session: Session):
    """Verify that report metrics dynamically equal the filtered student row count."""
    config = ReportConfig(
        report_type="STUDENT_PERFORMANCE",
        department="CSE(CS)",
        year="III"
    )
    dataset = build_universal_report(db_session, config)
    assert dataset is not None
    rows = dataset.get("rows", [])
    total_count = dataset.get("metrics", {}).get("totalStudents")
    
    assert total_count == len(rows), f"Metric totalStudents ({total_count}) != row count ({len(rows)})"
    for r in rows:
        assert r.get("dept") == "CSE(CS)"
        assert r.get("year") == "III"


# ==============================================================================
# 3. TEST CONTEST DATASET RESOLVER (_get_dataset_for_id)
# ==============================================================================

def test_get_dataset_for_id_filtered(db_session: Session):
    """Verify _get_dataset_for_id dynamically recalculates metrics for the filtered slice."""
    dataset, filename = _get_dataset_for_id("3", db_session, dept="CSE(CS)", year="III")
    assert dataset is not None
    assert ("CSE-CS" in filename or "CSE(CS)" in filename)
    assert "III" in filename

    rows = dataset["rows"]
    metrics = dataset["metrics"]
    assert metrics["totalStudents"] == len(rows)
    for r in rows:
        dept = r.get("dept") or r.get("department")
        year = r.get("year") or r.get("academic_year")
        assert dept == "CSE(CS)"
        assert year in ("III", "3")


def test_get_dataset_for_id_search(db_session: Session):
    """Verify _get_dataset_for_id respects search filter."""
    sample = db_session.query(Student).filter(Student.reg_no == "732223CI013").first()
    if sample:
        dataset, _ = _get_dataset_for_id("3", db_session, search="732223CI013")
        rows = dataset["rows"]
        assert len(rows) == 1
        assert rows[0]["reg_no"] == "732223CI013"
        assert dataset["metrics"]["totalStudents"] == 1


# ==============================================================================
# 4. TEST EXPORT HTTP ENDPOINTS WITH QUERY FILTERS
# ==============================================================================

def test_export_official_college_summary_endpoint(admin_headers: dict):
    """Verify /reports/export-official-college-summary returns valid Excel with filters."""
    response = client.get("/api/reports/export-official-college-summary?department=CSE(CS)&year=III", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 500


def test_export_student_performance_detail_endpoint(admin_headers: dict):
    """Verify /reports/export-student-performance-detail returns valid Excel with filters."""
    response = client.get("/api/reports/export-student-performance-detail?department=CSE(CS)&year=III", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 500


def test_export_pdf_endpoint_with_filters(admin_headers: dict):
    """Verify /reports/export-pdf returns valid PDF content."""
    response = client.get("/api/reports/export-pdf?department=CSE(CS)&year=III", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")


def test_export_csv_endpoint_with_filters(admin_headers: dict):
    """Verify /reports/export-csv returns valid CSV containing only matching department rows."""
    response = client.get("/api/reports/export-csv?department=CSE(CS)", headers=admin_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    text = response.text
    lines = text.strip().split("\n")
    # First line is header
    assert len(lines) > 1
    # Check that rows only contain CSE(CS)
    for line in lines[1:]:
        if line.strip():
            assert "CSE(CS)" in line


def test_export_universal_session_excel_with_filters(admin_headers: dict):
    """Verify /reports/{session_id}/excel returns filtered Excel file."""
    response = client.get("/api/reports/3/excel?dept=CSE(CS)&year=III", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 500


def test_export_universal_session_pdf_with_filters(admin_headers: dict):
    """Verify /reports/{session_id}/pdf returns filtered PDF file."""
    response = client.get("/api/reports/3/pdf?dept=CSE(CS)&year=III", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
