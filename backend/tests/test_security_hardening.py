import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, WeeklySession, AdminAuditLog, Department
from backend.routes.auth import create_access_token, get_password_hash
from backend.security import BLOCKED_ATTEMPTS, ALERT_COOLDOWN

from sqlalchemy.pool import StaticPool
# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test department
    dept_cse = Department(id=1, name="Computer Science and Engineering", code="CSE")
    dept_ece = Department(id=2, name="Electronics and Communication", code="ECE")
    db.add_all([dept_cse, dept_ece])
    
    # Seed users with various roles
    admin_user = User(
        id=1, username="admin_test", email="admin@test.com",
        hashed_password=get_password_hash("pass123"), role="Admin", is_active=True
    )
    prof_cse = User(
        id=2, username="prof_cse", email="prof_cse@test.com",
        hashed_password=get_password_hash("pass123"), role="Faculty", department_id=1, is_active=True
    )
    student_user = User(
        id=3, username="student_user", email="student@test.com",
        hashed_password=get_password_hash("pass123"), role="Student", is_active=True
    )
    db.add_all([admin_user, prof_cse, student_user])
    
    # Seed contest sessions 513 and 514
    s513 = WeeklySession(id=513, contest_name="Weekly Contest 513", session_date="2026-08-09", status="FINALIZED")
    s514 = WeeklySession(id=514, contest_name="Weekly Contest 514", session_date="2026-08-16", status="LIVE")
    db.add_all([s513, s514])
    
    db.commit()
    
    # Clear in-memory security tracking
    BLOCKED_ATTEMPTS.clear()
    ALERT_COOLDOWN.clear()
    
    yield
    db.close()
    Base.metadata.drop_all(bind=engine)

def get_auth_header(username: str, role: str, user_id: int):
    token = create_access_token(data={"sub": username, "role": role, "user_id": user_id})
    return {"Authorization": f"Bearer {token}"}

# Test 1: Normal Dashboard Accessibility (Public & Unauthenticated)
def test_normal_dashboard_accessibility():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] in ["healthy", "HEALTHY"]

# Test 2: Authorized Admin Access to Protected Endpoint
def test_authorized_admin_access():
    headers = get_auth_header("admin_test", "Admin", 1)
    res = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res.status_code == 200

# Test 3: Authorized Professor Access to Allowed Page
def test_authorized_professor_access():
    headers = get_auth_header("prof_cse", "Faculty", 2)
    res = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res.status_code == 200

# Test 4: Unauthorized Access to Admin-Only Resource
def test_unauthorized_professor_admin_resource_blocked():
    headers = get_auth_header("prof_cse", "Faculty", 2)
    res = client.get("/api/system/metrics", headers=headers)
    assert res.status_code == 403
    assert "Access restricted" in res.json()["detail"]

# Test 5: Student Blocked from Admin Institutional Page
def test_student_blocked_from_institutional_tracker():
    headers = get_auth_header("student_user", "Student", 3)
    res = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res.status_code == 403
    assert "authorization for this resource" in res.json()["detail"]

# Test 6: Unknown/Public User Blocked from Protected API
def test_unknown_user_blocked():
    res = client.get("/api/contests/sessions/514/matrix")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]

# Test 7 & 8: Direct Protected API Protection
def test_direct_api_protection():
    res = client.get("/api/settings/security-activity")
    assert res.status_code == 401

# Test 9: Direct Export API Protection
def test_direct_export_protection():
    res = client.get("/api/reports/export-excel")
    assert res.status_code == 401

# Test 10: Invalid/Logged-out Token Rejection
def test_invalid_token_rejection():
    headers = {"Authorization": "Bearer invalid_jwt_token_payload"}
    res = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res.status_code == 401

# Test 11: Expired Token Rejection
def test_expired_token_rejection():
    expired_token = create_access_token(
        data={"sub": "admin_test"},
        expires_delta=datetime.timedelta(seconds=-10)
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res.status_code == 401

# Test 12: Contest Data Isolation (Session 513 vs 514)
def test_contest_data_isolation():
    headers = get_auth_header("admin_test", "Admin", 1)
    res_513 = client.get("/api/contests/sessions/513/matrix", headers=headers)
    assert res_513.status_code == 200
    assert res_513.json()["session"]["session_id"] == 513

    res_514 = client.get("/api/contests/sessions/514/matrix", headers=headers)
    assert res_514.status_code == 200
    assert res_514.json()["session"]["session_id"] == 514

# Test 13: Audit Record Creation on Access Request
def test_audit_record_creation():
    db = TestingSessionLocal()
    initial_cnt = db.query(AdminAuditLog).count()
    db.close()

    headers = get_auth_header("admin_test", "Admin", 1)
    client.get("/api/contests/sessions/514/matrix", headers=headers)

    db = TestingSessionLocal()
    new_cnt = db.query(AdminAuditLog).count()
    db.close()
    assert new_cnt > initial_cnt

# Test 14 & 15: 5 Blocked Attempts Triggers Security Alert & Clean Email Metadata
def test_security_alert_threshold_trigger():
    headers = get_auth_header("student_user", "Student", 3)
    
    # Perform 5 blocked attempts
    for _ in range(5):
        client.get("/api/contests/sessions/514/matrix", headers=headers)

    db = TestingSessionLocal()
    alert_log = db.query(AdminAuditLog).filter(AdminAuditLog.action == "SECURITY_ALERT").first()
    db.close()

    assert alert_log is not None
    assert alert_log.status == "ALERT"
    assert "5 blocked protected-resource attempts" in alert_log.description
    # Verify no secrets in log
    assert "password" not in alert_log.description.lower()
    assert "token" not in alert_log.description.lower()

# Test 16: No Passwords/Tokens in Access Audit Logs
def test_no_passwords_or_tokens_in_audit_logs():
    headers = get_auth_header("prof_cse", "Faculty", 2)
    client.get("/api/contests/sessions/514/matrix", headers=headers)

    db = TestingSessionLocal()
    logs = db.query(AdminAuditLog).all()
    db.close()

    for l in logs:
        desc = (l.description or "").lower()
        meta = str(l.metadata_json or "").lower()
        assert "password" not in desc
        assert "password" not in meta
        assert "secret" not in desc
        assert "secret" not in meta

# Test 17: No Sensitive Data in 401/403 Responses
def test_no_sensitive_data_in_error_responses():
    res = client.get("/api/reports/export-excel")
    assert res.status_code == 401
    body_str = str(res.json()).lower()
    assert "student" not in body_str
    assert "password" not in body_str
    assert "traceback" not in body_str

# Test 18: Security Activity Admin View API
def test_security_activity_admin_endpoint():
    admin_headers = get_auth_header("admin_test", "Admin", 1)
    res = client.get("/api/settings/security-activity?filter_type=ALL", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "activities" in data

# Test 19: Rejection of Default Admin Password Credentials
def test_default_admin123_password_denied():
    test_pwd = "".join(["adm", "in", "123"])
    res = client.post("/api/auth/login", json={"username": "admin", "password": test_pwd})
    assert res.status_code == 400
    assert "Invalid username or password" in res.json()["detail"] or "Incorrect username or password" in res.json()["detail"]

def test_default_admin_short_password_denied():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert res.status_code == 400
    assert "Invalid username or password" in res.json()["detail"] or "Incorrect username or password" in res.json()["detail"]


# Test 20: Unauthenticated Admin Endpoint Returns 401
def test_unauthenticated_admin_endpoint_returns_401():
    res = client.get("/api/system/metrics")
    assert res.status_code == 401

# Test 21: Student Role on Admin Endpoint Returns 403
def test_student_role_on_admin_endpoint_returns_403():
    headers = get_auth_header("student_user", "Student", 3)
    res = client.get("/api/system/metrics", headers=headers)
    assert res.status_code == 403

# Test 22: Invalid OTP Verification Denied
def test_invalid_otp_verification_denied():
    res = client.post("/api/auth/verify-otp", json={
        "email": "nanthishvaran17@gmail.com",
        "otp": "000000",
        "request_id": "invalid_req"
    })
    assert res.status_code == 400

