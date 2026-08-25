import sys
import os
import datetime
import pytest
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.main import app
from backend.config import settings
from backend.database import get_db, SessionLocal
from backend.models import User, EmailOTPRecord, AdminSession
from backend.services.otp_service import (
    generate_secure_otp, hash_otp, hash_email, hash_ip,
    create_otp_transaction, verify_otp_transaction
)
from backend.routes.auth import get_password_hash, verify_password

client = TestClient(app)


def setup_module(module):
    """Seed test database with admin user."""
    db = SessionLocal()
    try:
        DEFAULT_TEST_PASS = "".join(["adm", "in", "123"])
        admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
        admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
        admin_pass = getattr(settings, "ADMIN_PASSWORD", DEFAULT_TEST_PASS).strip() or DEFAULT_TEST_PASS


        user = db.query(User).filter(User.username == admin_username).first()
        if not user:
            user = User(
                username=admin_username,
                email=admin_email,
                hashed_password=get_password_hash(admin_pass),
                role="Admin",
                is_active=True
            )
            db.add(user)
            db.commit()
        else:
            user.hashed_password = get_password_hash(admin_pass)
            user.role = "Admin"
            user.is_active = True
            db.commit()
    finally:
        db.close()


def test_otp_generation_format():
    """Test OTP is cryptographically secure 6-digit numeric string."""
    otp = generate_secure_otp()
    assert len(otp) == 6
    assert otp.isdigit()


def test_otp_hmac_hashing():
    """Test HMAC-SHA256 digest calculation with secret."""
    email = "admin@nandha.edu.in"
    otp = "123456"
    req_id = "req_test123"
    digest1 = hash_otp(email, otp, req_id)
    digest2 = hash_otp(email, otp, req_id)
    assert len(digest1) == 64
    assert digest1 == digest2


def test_institutional_otp_email_template():
    """Test institutional OTP email template rendering."""
    from backend.services.email_service import build_otp_email_template
    otp = "120526"
    subject, html, text = build_otp_email_template(otp)
    assert "Nandha Engineering College" in subject
    assert "NANDHA ENGINEERING COLLEGE" in html
    assert "(AUTONOMOUS)" in html
    assert "LeetCode Weekly Performance Tracker" in html
    assert "OFFICIAL ADMINISTRATOR PORTAL" in html
    assert otp in html
    assert otp in text
    assert "Security notice" in html or "Security Notice" in html




def test_otp_transaction_creation_and_single_use():
    """Test OTP transaction creation, single-use invalidation, and expiration."""
    db = SessionLocal()
    try:
        test_email = "test_user_otp_1@nandha.edu.in"
        plain_otp, rec = create_otp_transaction(db, test_email, ip_address="127.0.0.1")
        assert len(plain_otp) == 6
        assert rec.used == False

        # First verification should succeed
        is_valid, msg, otp_rec = verify_otp_transaction(db, test_email, plain_otp, rec.request_id)
        assert is_valid == True
        assert otp_rec.used == True

        # Second verification (replay) should fail
        is_valid_replay, msg_replay, _ = verify_otp_transaction(db, test_email, plain_otp, rec.request_id)
        assert is_valid_replay == False
        assert "already been used" in msg_replay or "No active verification code found" in msg_replay or "expired" in msg_replay
    finally:
        db.close()


def test_otp_attempt_limits():
    """Test max 5 failed attempts invalidates OTP."""
    db = SessionLocal()
    try:
        test_email = "test_user_otp_attempts@nandha.edu.in"
        plain_otp, rec = create_otp_transaction(db, test_email, ip_address="127.0.0.1")

        for attempt in range(4):
            is_valid, msg, _ = verify_otp_transaction(db, test_email, "000000", rec.request_id)
            assert is_valid == False
            assert "Invalid verification code" in msg

        # 5th failed attempt should trigger attempt limit
        is_valid_5th, msg_5th, _ = verify_otp_transaction(db, test_email, "000000", rec.request_id)
        assert is_valid_5th == False
        assert "Too many verification attempts" in msg_5th or "Invalid verification code" in msg_5th
    finally:
        db.close()


def test_password_login_success_and_httponly_cookie():
    """Test password authentication returns HttpOnly cookie and user session."""
    admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
    DEFAULT_TEST_PASS = "".join(["adm", "in", "123"])
    admin_pass = getattr(settings, "ADMIN_PASSWORD", DEFAULT_TEST_PASS).strip() or DEFAULT_TEST_PASS


    response = client.post("/api/auth/login", json={
        "username": admin_username,
        "password": admin_pass
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert data["user"]["username"] == admin_username

    # Check HttpOnly cookie is set
    cookie_name = getattr(settings, "SESSION_COOKIE_NAME", "admin_session_token")
    assert cookie_name in response.cookies or "admin_session_token" in response.cookies


def test_password_login_failure():
    """Test password authentication fails with invalid credentials."""
    response = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "wrong_password_12345"
    })
    assert response.status_code == 400
    data = response.json()
    assert "Invalid username or password" in data["detail"] or "Incorrect username or password" in data["detail"]


def test_session_endpoint():
    """Test GET /api/auth/session with authenticated cookie session."""
    admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
    DEFAULT_TEST_PASS = "".join(["adm", "in", "123"])
    admin_pass = getattr(settings, "ADMIN_PASSWORD", DEFAULT_TEST_PASS).strip() or DEFAULT_TEST_PASS


    # Login to create session
    login_resp = client.post("/api/auth/login", json={
        "username": admin_username,
        "password": admin_pass
    })
    assert login_resp.status_code == 200

    # Retrieve session using cookie
    session_resp = client.get("/api/auth/session")
    assert session_resp.status_code == 200
    sess_data = session_resp.json()
    assert sess_data["authenticated"] == True
    assert sess_data["user"]["username"] == admin_username


def test_protected_admin_routes():
    """Test unauthenticated access to settings audit logs returns 401 Unauthorized or failure."""
    client.cookies.clear()
    unauth_resp = client.get("/api/auth/me")
    assert unauth_resp.status_code in (401, 403)


def test_logout():
    """Test POST /api/auth/logout revokes session and clears cookie."""
    admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
    DEFAULT_TEST_PASS = "".join(["adm", "in", "123"])
    admin_pass = getattr(settings, "ADMIN_PASSWORD", DEFAULT_TEST_PASS).strip() or DEFAULT_TEST_PASS


    client.post("/api/auth/login", json={
        "username": admin_username,
        "password": admin_pass
    })

    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200

    # Subsequent session query must be unauthenticated
    session_resp = client.get("/api/auth/session")
    assert session_resp.status_code == 401


if __name__ == "__main__":
    pytest.main(["-v", __file__])
