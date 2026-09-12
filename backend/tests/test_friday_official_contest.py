import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User
from backend.routes.auth import create_access_token, get_password_hash
from backend.services.report_models import ReportConfig
from backend.services.contest_performance_service import build_contest_performance_report

def test_friday_official_contest_service():
    db = SessionLocal()
    try:
        config = ReportConfig(
            report_type="FRIDAY_OFFICIAL_CONTEST",
            department="ALL",
            year="ALL",
            output_scope="COLLEGE"
        )
        dataset = build_contest_performance_report(db, config)

        assert dataset["reportTitle"] == "Friday Official Contest Result"
        assert dataset["collegeName"] == "NANDHA ENGINEERING COLLEGE"
        assert dataset["academicYear"] == "Academic Year 2026–2027"
        assert "versionString" in dataset
        assert "questionWiseResult" in dataset
        assert "solveDistributionList" in dataset
        assert "officialLeaderboard" in dataset
        assert "departmentResults" in dataset
        assert "allStudents" in dataset
        assert "isValidated" in dataset

        # Verify student row fields
        for row in dataset["allStudents"]:
            assert "s_no" in row
            assert "reg_no" in row
            assert "name" in row
            assert "dept" in row
            assert "year" in row
            assert "leetcode_handle" in row
            assert "status" in row
            assert "q1" in row
            assert "q2" in row
            assert "q3" in row
            assert "q4" in row
            assert "contest_solved" in row
            assert "score" in row
            assert "rank" in row
            assert "rating" in row
    finally:
        db.close()


def test_friday_official_contest_endpoint():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role.in_(["admin", "super admin", "super_admin", "principal", "Principal"])).first()
        if not admin_user:
            admin_user = User(
                username="admin_test_spec",
                hashed_password=get_password_hash("Password123!"),
                role="admin",
                email="admin_spec@nec.edu.in"
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        
        token = create_access_token(data={"sub": admin_user.username, "user_id": admin_user.id, "role": admin_user.role})
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/reports/friday-official-result", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["reportTitle"] == "Friday Official Contest Result"
        assert data["collegeName"] == "NANDHA ENGINEERING COLLEGE"
    finally:
        db.close()
