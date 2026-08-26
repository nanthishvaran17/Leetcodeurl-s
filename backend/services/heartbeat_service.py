"""
heartbeat_service.py — Production Reliability & Heartbeat Monitoring Engine
Tracks live background worker heartbeats, scheduler execution states, and deep system diagnostics.
"""

import os
import time
import datetime
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

# In-Memory & Cache Heartbeat Store
_WORKER_HEARTBEAT: Dict[str, Any] = {
    "worker_id": "canonical_sync_daemon_01",
    "status": "RUNNING",
    "last_seen": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "current_job": "IDLE_MONITORING",
    "last_successful_job": "INSTITUTIONAL_STUDENT_SYNC",
    "last_failure": None,
    "consecutive_failures": 0
}

_SCHEDULER_HEARTBEAT: Dict[str, Any] = {
    "status": "RUNNING",
    "timezone": "Asia/Kolkata",
    "last_seen": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "last_successful_job": None,
    "next_scheduled_job": "sunday_0755_init",
    "last_failure": None
}

_PROCESS_START_TIME = time.time()


def record_worker_heartbeat(
    status: str = "RUNNING",
    current_job: Optional[str] = None,
    last_successful_job: Optional[str] = None,
    last_failure: Optional[str] = None
) -> None:
    """Updates live background worker telemetry."""
    global _WORKER_HEARTBEAT
    _WORKER_HEARTBEAT["status"] = status
    _WORKER_HEARTBEAT["last_seen"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if current_job:
        _WORKER_HEARTBEAT["current_job"] = current_job
    if last_successful_job:
        _WORKER_HEARTBEAT["last_successful_job"] = last_successful_job
    if last_failure:
        _WORKER_HEARTBEAT["last_failure"] = last_failure
        _WORKER_HEARTBEAT["consecutive_failures"] += 1
    else:
        _WORKER_HEARTBEAT["consecutive_failures"] = 0


def get_worker_heartbeat() -> Dict[str, Any]:
    """Returns current worker health status with staleness detector."""
    data = dict(_WORKER_HEARTBEAT)
    try:
        last_dt = datetime.datetime.fromisoformat(data["last_seen"])
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
        delta_sec = (now_dt - last_dt).total_seconds()
        data["seconds_since_last_seen"] = round(delta_sec, 1)
        if delta_sec > 180: # 3 minutes without heartbeat = STALE
            data["status"] = "STALE"
    except Exception:
        data["seconds_since_last_seen"] = 0
    return data


def record_scheduler_heartbeat(
    status: str = "RUNNING",
    last_successful_job: Optional[str] = None,
    next_scheduled_job: Optional[str] = None,
    last_failure: Optional[str] = None
) -> None:
    """Updates live scheduler telemetry."""
    global _SCHEDULER_HEARTBEAT
    _SCHEDULER_HEARTBEAT["status"] = status
    _SCHEDULER_HEARTBEAT["last_seen"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if last_successful_job:
        _SCHEDULER_HEARTBEAT["last_successful_job"] = last_successful_job
    if next_scheduled_job:
        _SCHEDULER_HEARTBEAT["next_scheduled_job"] = next_scheduled_job
    if last_failure:
        _SCHEDULER_HEARTBEAT["last_failure"] = last_failure


def get_scheduler_heartbeat() -> Dict[str, Any]:
    """Returns current scheduler state."""
    return dict(_SCHEDULER_HEARTBEAT)


def get_deep_health_telemetry(db: Session) -> Dict[str, Any]:
    """
    Executes a comprehensive, authenticated deep health check across:
    Database connectivity, query latency, student roster count, worker heartbeat,
    scheduler state, SQLite WAL journal verification, and process uptime.
    """
    t0 = time.perf_counter()
    db_status = "HEALTHY"
    db_latency_ms = 0.0
    student_count = 0
    wal_status = "UNKNOWN"

    try:
        res = db.execute(text("SELECT count(id) FROM students")).scalar()
        student_count = res or 0
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        
        # Check SQLite journal mode
        wal_res = db.execute(text("PRAGMA journal_mode")).scalar()
        wal_status = str(wal_res).upper() if wal_res else "WAL"
    except Exception as e:
        db_status = f"UNHEALTHY: {str(e)}"

    worker_info = get_worker_heartbeat()
    scheduler_info = get_scheduler_heartbeat()
    uptime_sec = round(time.time() - _PROCESS_START_TIME, 1)

    overall_status = "HEALTHY"
    if "UNHEALTHY" in db_status or worker_info.get("status") == "STOPPED":
        overall_status = "DEGRADED"

    return {
        "status": overall_status,
        "uptime_seconds": uptime_sec,
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "database": {
            "status": db_status,
            "latency_ms": db_latency_ms,
            "student_records": student_count,
            "journal_mode": wal_status
        },
        "worker": worker_info,
        "scheduler": scheduler_info,
        "platform": {
            "service": "Nandha LeetCode Intelligence API",
            "version": "2.4.0",
            "environment": os.environ.get("INSTANCE_ID") or os.environ.get("HOSTNAME") or "cloud-production"
        }
    }
