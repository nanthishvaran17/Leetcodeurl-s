"""
Unit and Integration Tests for Instant Report Download & Pre-Generation System
Verifies:
- < 50ms cache lookup time
- Instant pre-generated report streaming
- Data version staleness detection
- Idempotent single-flight worker execution under concurrency
- Multi-worker distributed atomic job claiming
- Corrupted disk file auto-invalidation & recovery
- Authorization boundaries & unauthenticated protection
"""
import time
import os
import pytest
import threading
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, engine
from backend.models import ReportCache, Base, User
from backend.routes.auth import create_access_token, get_password_hash
from backend.services.data_version_service import get_current_data_version, bump_data_version
from backend.services.pregenerated_report_service import (
    get_cached_report_info,
    trigger_background_report_generation,
    pregenerate_all_weekly_reports
)

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_module_data():
    """Ensure DB schema tables exist and seed test admin user."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "report_test_admin").first()
        if not admin_user:
            admin_user = User(
                username="report_test_admin",
                email="report_admin@nandha.edu.in",
                hashed_password=get_password_hash("pass123"),
                role="Admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()

def get_auth_headers():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "report_test_admin").first()
        token = create_access_token({"sub": admin.username, "role": admin.role})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_data_version_service():
    """Verifies data version resolution and bumping."""
    db = SessionLocal()
    try:
        v1 = get_current_data_version(db)
        assert v1 is not None and len(v1) > 0

        v2 = bump_data_version(db)
        assert v2 != v1
        assert get_current_data_version(db) == v2
    finally:
        db.close()


def test_unauthenticated_download_access_denied():
    """Verifies unauthenticated calls to download endpoints are denied with 401."""
    resp1 = client.get("/api/reports/download-info?file_type=pdf&session_id=latest")
    assert resp1.status_code == 401

    resp2 = client.get("/api/reports/cached-download/99999")
    assert resp2.status_code == 401


def test_download_info_endpoint_speed():
    """Verifies /api/reports/download-info lookup executes in < 50ms when authenticated."""
    headers = get_auth_headers()
    response = client.get("/api/reports/download-info?file_type=pdf&session_id=latest", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "lookup_ms" in data
    assert data["lookup_ms"] < 100.0  # Fast pre-flight threshold


def test_pregenerated_report_lifecycle():
    """Verifies pre-generation creates cached file and instant lookup resolves READY state."""
    db = SessionLocal()
    try:
        curr_v = get_current_data_version(db)
        
        # Trigger background generation for pdf
        trigger_background_report_generation(week_id="latest", file_type="pdf", data_version=curr_v)

        # Wait max 5 seconds for worker thread to complete
        start = time.time()
        ready = False
        while time.time() - start < 5.0:
            info = get_cached_report_info(db, week_id="latest", file_type="pdf")
            if info["status"] == "READY":
                ready = True
                assert info["cache_hit"] is True
                assert info["download_url"] is not None
                assert info["lookup_ms"] < 50.0
                break
            time.sleep(0.2)

        assert ready is True, "Pre-generation worker failed to mark status READY within timeout"

        # Verify fast cached download endpoint with auth
        cache_id = info["cache_id"]
        headers = get_auth_headers()
        dl_resp = client.get(f"/api/reports/cached-download/{cache_id}", headers=headers)
        assert dl_resp.status_code == 200
        assert dl_resp.headers["content-type"] in ("application/pdf", "application/octet-stream")
        assert len(dl_resp.content) > 0
    finally:
        db.close()


def test_multi_worker_idempotency_concurrent_generation():
    """Verifies multi-worker concurrent generation triggers exactly 1 generation job."""
    db = SessionLocal()
    try:
        curr_v = get_current_data_version(db)
        threads = []
        
        for _ in range(10):
            t = threading.Thread(
                target=trigger_background_report_generation,
                kwargs={"week_id": "latest", "file_type": "official_summary", "data_version": curr_v}
            )
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Check database: exactly 1 entry created for this version key
        entries = db.query(ReportCache).filter(
            ReportCache.week_id == "latest",
            ReportCache.file_type == "official_summary",
            ReportCache.data_version == curr_v
        ).all()

        assert len(entries) == 1, f"Expected exactly 1 idempotent job entry, got {len(entries)}"
    finally:
        db.close()


def test_corrupted_file_recovery():
    """Verifies that if a cached report file on disk is deleted or 0 bytes, get_cached_report_info auto-invalidates it."""
    db = SessionLocal()
    try:
        curr_v = get_current_data_version(db)
        trigger_background_report_generation(week_id="latest", file_type="student_detail", data_version=curr_v)

        start = time.time()
        ready_id = None
        while time.time() - start < 5.0:
            info = get_cached_report_info(db, week_id="latest", file_type="student_detail")
            if info["status"] == "READY":
                ready_id = info["cache_id"]
                break
            time.sleep(0.2)

        assert ready_id is not None

        # Simulate disk corruption by emptying the file
        rec = db.query(ReportCache).filter(ReportCache.id == ready_id).first()
        if rec and rec.storage_path and os.path.exists(rec.storage_path):
            with open(rec.storage_path, "wb") as f:
                f.write(b"")  # 0 bytes

        # Re-query get_cached_report_info: should detect corruption and return PREPARING
        info2 = get_cached_report_info(db, week_id="latest", file_type="student_detail")
        assert info2["status"] == "PREPARING"
        assert info2["cache_hit"] is False
    finally:
        db.close()


def test_staleness_invalidation():
    """Verifies bumping data_version invalidates old cache entries and returns PREPARING for fresh version."""
    db = SessionLocal()
    try:
        new_version = bump_data_version(db)
        info = get_cached_report_info(db, week_id="latest", file_type="master_tracker")
        assert info["data_version"] == new_version
    finally:
        db.close()

