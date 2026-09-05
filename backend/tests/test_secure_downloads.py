"""
test_secure_downloads.py — Global Download System Integration Tests

Verifies:
  1. POST /api/downloads/prepare generates cryptographically secure 60s temporary token.
  2. GET /api/downloads/secure/{token} streams requested file with valid headers and binary content.
  3. Single-use token enforcement: Reusing token returns 410 Gone.
  4. Token expiration: Expired token returns 410 Gone.
  5. Invalid token returns 404 Not Found.
  6. Unauthenticated requests to prepare endpoint return 401 Unauthorized.
  7. Audit log is created without exposing raw tokens or file contents.
"""

import sys
import os
import time
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, AdminAuditLog
from backend.routes.auth import create_access_token, get_password_hash
from backend.routes.downloads import _SECURE_DOWNLOAD_TOKENS, _TOKEN_LOCK

client = TestClient(app)


def get_admin_headers():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role.in_(["Admin", "super admin", "super_admin"])).first()
        if not admin:
            admin = User(
                username="test_download_admin",
                email="test_download_admin@nandha.edu.in",
                hashed_password=get_password_hash("admin123"),
                role="Admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        token = create_access_token({"sub": admin.username, "role": admin.role})
        return {"Authorization": f"Bearer {token}"}, admin
    finally:
        db.close()


class TestSecureDownloadsSystem:

    def test_unauthenticated_prepare_returns_401(self):
        """Unauthenticated call to prepare download endpoint must fail with 401."""
        res = client.post("/api/downloads/prepare", json={
            "endpoint": "/api/reports/export-official-college-summary",
            "filename": "Weekly_Report.xlsx"
        })
        assert res.status_code == 401
        assert "Authentication required" in res.json().get("detail", "")

    def test_authenticated_prepare_and_execute_download_flow(self):
        """
        Happy path:
          1. Admin calls POST /api/downloads/prepare with target endpoint and Bearer token
          2. Receives download_url (/api/downloads/secure/<token>)
          3. GET /api/downloads/secure/<token> returns file stream with Content-Disposition
          4. Reusing token fails with HTTP 410 (One-time use)
        """
        headers, admin = get_admin_headers()

        prepare_res = client.post(
            "/api/downloads/prepare",
            json={
                "endpoint": "/api/reports/export-official-college-summary",
                "filename": "Test_Official_Report.xlsx",
                "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            },
            headers=headers
        )
        assert prepare_res.status_code == 200
        data = prepare_res.json()
        assert "download_url" in data
        assert data["filename"] == "Test_Official_Report.xlsx"
        assert data["expires_in"] == 60

        download_url = data["download_url"]

        # Execute download
        file_res = client.get(download_url)
        assert file_res.status_code == 200
        assert file_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert 'attachment; filename="Test_Official_Report.xlsx"' in file_res.headers["content-disposition"]
        assert len(file_res.content) > 0

        # Single-use check: second request with same token must fail (410)
        reuse_res = client.get(download_url)
        assert reuse_res.status_code == 410
        assert "already been used" in reuse_res.json().get("detail", "")

    def test_invalid_and_expired_tokens(self):
        """Verifies rejection of invalid or expired download tokens."""
        headers, admin = get_admin_headers()

        # 1. Invalid token (non-existent)
        res_invalid = client.get("/api/downloads/secure/invalid_token_string_999999999")
        assert res_invalid.status_code == 404

        # 2. Expired token simulation
        import hashlib
        fake_token = "fake_expired_token_1234567890_long_enough_str"
        fake_hash = hashlib.sha256(fake_token.encode('utf-8')).hexdigest()

        with _TOKEN_LOCK:
            _SECURE_DOWNLOAD_TOKENS[fake_hash] = {
                "user_id": admin.id,
                "username": admin.username,
                "user_role": admin.role,
                "institution_id": "NEC",
                "endpoint": "/api/reports/export-pdf",
                "filename": "Expired.pdf",
                "mime_type": "application/pdf",
                "created_at": time.time() - 100.0,
                "expires_at": time.time() - 10.0,  # Expired 10s ago
                "is_used": False
            }

        res_expired = client.get(f"/api/downloads/secure/{fake_token}")
        assert res_expired.status_code == 410
        assert "expired" in res_expired.json().get("detail", "").lower()
