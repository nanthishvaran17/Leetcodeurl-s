import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.models import Student, SyncJob, AuditLog

client = TestClient(app)

def test_admin_system_health_endpoint():
    """
    Verifies that /api/system/admin/system-health returns comprehensive, unhardcoded health telemetry.
    """
    response = client.get("/api/system/admin/system-health")
    assert response.status_code == 200
    data = response.json()

    assert data["overall_status"] in ["OPERATIONAL", "DEGRADED", "WARNING", "CRITICAL", "OFFLINE"]
    assert "IST" in data["timestamp_ist"]
    
    # Verify Database component telemetry
    db_data = data["database"]
    assert db_data["status"] == "HEALTHY"
    assert db_data["connection"] == "Connected"
    assert isinstance(db_data["latency_ms"], float)
    assert isinstance(db_data["roster_records"], int)
    assert isinstance(db_data["contest_records"], int)

    # Verify API Engine telemetry
    api_data = data["api_engine"]
    assert api_data["status"] in ["HEALTHY", "DEGRADED", "WARNING"]
    assert isinstance(api_data["latency_ms"], float)

    # Verify Scheduler telemetry
    sched_data = data["scheduler"]
    assert sched_data["status"] in ["ACTIVE", "STOPPED"]
    assert "Asia/Kolkata" in sched_data["timezone"]

    # Verify Data Freshness telemetry
    freshness = data["data_freshness"]
    assert freshness["status"] in ["FRESH", "AGING", "STALE"]

    # Verify Email Telemetry
    email_data = data["email"]
    assert email_data["status"] in ["CONNECTED", "PROVIDER_ERROR"]
    assert "Brevo" in email_data["provider"] or "API" in email_data["provider"]


def test_trigger_sync_now_endpoint():
    """
    Verifies that /api/system/sync-now triggers manual contest synchronization.
    """
    response = client.post("/api/system/sync-now")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "records_checked" in data
    assert "IST" in data["timestamp_ist"]


def test_trigger_scheduler_now_endpoint():
    """
    Verifies that /api/system/run-scheduler-now triggers Sunday automation pipeline.
    """
    response = client.post("/api/system/run-scheduler-now")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["pipeline_status"] == "COMPLETED"
    assert "IST" in data["timestamp_ist"]
