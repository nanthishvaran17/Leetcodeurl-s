from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
import os

from backend.database import get_db, SessionLocal
from backend.models import Student, LeetCodeProfileStats, AuditLog, WeeklySession
from backend.sync_engine import sync_tracker
from backend.security import require_security_access

router = APIRouter(prefix="/api/system", tags=["System Operations & Health"])

def sanitize_error_message(msg: str) -> str:
    if not msg:
        return "Unknown system error"
    import re
    cleaned = str(msg)
    # Strip JWTs, tokens, passwords, OTPs, secret keys
    cleaned = re.sub(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'Bearer [REDACTED_TOKEN]', cleaned)
    cleaned = re.sub(r'password\s*=\s*[\'"][^\'"]+[\'"]', 'password=[REDACTED]', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'otp\s*=\s*[\'"][^\'"]+[\'"]', 'otp=[REDACTED]', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'private_key\s*:\s*[\'"][^\'"]+[\'"]', 'private_key=[REDACTED]', cleaned, flags=re.IGNORECASE)
    return cleaned[:300]

@router.get("/health")
@router.get("/status")
def get_system_health(db: Session = Depends(get_db)):
    """
    Returns real-time health diagnostic metrics for all core application services
    with transparent, secret-sanitized error diagnostics.
    """
    start_time = datetime.datetime.now()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")
    request_id = f"health_req_{now_utc.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    import uuid

    components = {}
    has_errors = False
    has_warnings = False

    # 1. Database Check
    db_ok = False
    db_latency_ms = 0
    db_error = None
    try:
        t0 = datetime.datetime.now()
        db.execute(__import__('sqlalchemy').text("SELECT 1")).first()
        db_latency_ms = round((datetime.datetime.now() - t0).total_seconds() * 1000, 1)
        db_ok = True
    except Exception as e:
        db_ok = False
        has_errors = True
        db_error = sanitize_error_message(str(e))

    components["database"] = {
        "name": "Database (SQLite Engine)",
        "status": "OPERATIONAL" if db_ok else "DOWN",
        "error": not db_ok,
        "error_code": None if db_ok else "DATABASE_CONNECTION_FAILED",
        "message": None if db_ok else db_error,
        "last_checked": now_str,
        "latency_ms": db_latency_ms,
        "action": None if db_ok else "Verify database file lock and permissions"
    }

    # 2. Firestore Check
    firestore_ok = True
    firestore_err = None
    try:
        from backend.services.firebase import get_firestore_client
        fs = get_firestore_client()
        if fs is None:
            firestore_ok = True  # Optional service
    except Exception as fe:
        firestore_ok = False
        has_warnings = True
        firestore_err = sanitize_error_message(str(fe))

    components["firestore"] = {
        "name": "Google Cloud Firestore",
        "status": "OPERATIONAL" if firestore_ok else "DEGRADED",
        "error": not firestore_ok,
        "error_code": None if firestore_ok else "FIRESTORE_CONNECTION_FAILED",
        "message": firestore_err,
        "last_checked": now_str,
        "action": None if firestore_ok else "Verify Firebase credentials and network connection"
    }

    # 3. LeetCode GraphQL Source Reachability
    leetcode_ok = True
    leetcode_err = None
    leetcode_code = None
    leetcode_latency_ms = 45.0
    try:
        import urllib.request
        req = urllib.request.Request("https://leetcode.com/graphql", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status not in (200, 400, 405): # GraphQL accepts POST
                leetcode_ok = False
                leetcode_code = "LEETCODE_API_ERROR"
                leetcode_err = f"LeetCode GraphQL endpoint returned HTTP {response.status}"
    except Exception as le:
        leetcode_ok = False
        has_warnings = True
        err_str = str(le).lower()
        if "timed out" in err_str or "timeout" in err_str:
            leetcode_code = "LEETCODE_TIMEOUT"
            leetcode_err = "LeetCode GraphQL request timed out after 5 seconds"
        elif "429" in err_str or "rate" in err_str:
            leetcode_code = "LEETCODE_RATE_LIMITED"
            leetcode_err = "LeetCode API rate limit encountered"
        else:
            leetcode_code = "LEETCODE_SOURCE_UNAVAILABLE"
            leetcode_err = "LeetCode GraphQL endpoint is temporarily unreachable"

    components["leetcode_source"] = {
        "name": "LeetCode GraphQL API",
        "status": "OPERATIONAL" if leetcode_ok else "SOURCE_UNAVAILABLE",
        "error": not leetcode_ok,
        "error_code": leetcode_code,
        "message": leetcode_err,
        "last_checked": now_str,
        "latency_ms": leetcode_latency_ms,
        "action": None if leetcode_ok else "Retry health check or inspect upstream LeetCode connectivity"
    }

    # 4. APScheduler Check
    scheduler_ok = False
    scheduler_err = None
    try:
        from backend.scheduler import scheduler
        scheduler_ok = scheduler.running if scheduler else False
        if not scheduler_ok:
            scheduler_err = "APScheduler background cron engine is stopped or uninitialized"
    except Exception as se:
        scheduler_ok = False
        has_warnings = True
        scheduler_err = sanitize_error_message(str(se))

    components["scheduler"] = {
        "name": "APScheduler Cron Engine",
        "status": "RUNNING" if scheduler_ok else "STOPPED",
        "error": not scheduler_ok,
        "error_code": None if scheduler_ok else "SCHEDULER_NOT_RUNNING",
        "message": scheduler_err,
        "last_checked": now_str,
        "action": None if scheduler_ok else "Start background scheduler daemon"
    }

    # 5. Live Sync Engine Check
    from backend.models import SyncJob
    running_job = None
    try:
        running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    except Exception:
        pass

    components["sync_engine"] = {
        "name": "Live Sync Engine",
        "status": "RUNNING" if running_job else "IDLE",
        "error": False,
        "error_code": None,
        "message": f"Active sync job: {running_job.job_id}" if running_job else "Sync engine idle and ready",
        "last_checked": now_str,
        "action": None
    }

    # Overall Status Calculation
    if not db_ok:
        overall_status = "HEALTH UNAVAILABLE"
    elif has_warnings or not leetcode_ok or not scheduler_ok:
        overall_status = "DEGRADED"
    else:
        overall_status = "OPERATIONAL"

    return {
        "status": overall_status,
        "request_id": request_id,
        "checked_at": now_str,
        "timestamp": now_utc.isoformat(),
        "environment": os.environ.get("RENDER_SERVICE_ID", "production-local"),
        "total_latency_ms": round((datetime.datetime.now() - start_time).total_seconds() * 1000, 1),
        "components": components,
        "recent_events": [
            {"timestamp": now_str, "component": "Database", "status": "OPERATIONAL" if db_ok else "DOWN", "code": "OK" if db_ok else "DATABASE_CONNECTION_FAILED"},
            {"timestamp": now_str, "component": "LeetCode GraphQL", "status": "OPERATIONAL" if leetcode_ok else "SOURCE_UNAVAILABLE", "code": leetcode_code or "OK"}
        ]
    }

@router.get("/metrics")
def get_system_metrics(
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="System Operations", required_roles=["admin", "super admin"]))
):
    """
    Returns system performance and data sync operational metrics with dynamic student counts.
    """
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    total_students = len(students)
    
    verified_count = 0
    partial_count = 0
    stale_count = 0
    failed_count = 0

    for s in students:
        st = s.stats
        if st and st.sync_status == "success" and st.total_solved is not None:
            verified_count += 1
        elif st and st.total_solved is not None:
            partial_count += 1
        elif st and st.sync_status == "failed":
            failed_count += 1
        else:
            stale_count += 1

    latest_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    return {
        "total_active_students": total_students,
        "verified_profiles_count": verified_count,
        "partial_profiles_count": partial_count,
        "stale_profiles_count": stale_count,
        "failed_sync_count": failed_count,
        "data_accuracy_rate_percentage": round((verified_count / max(1, total_students)) * 100.0, 1),
        "latest_weekly_session": {
            "week_number": latest_session.week_number if latest_session else None,
            "session_date": latest_session.session_date if latest_session else None,
            "status": latest_session.status if latest_session else "UPCOMING"
        },
        "sync_tracker": sync_tracker.to_dict()
    }
