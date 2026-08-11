from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
import os

from backend.database import get_db, SessionLocal
from backend.models import Student, LeetCodeProfileStats, AuditLog, WeeklySession
from backend.sync_engine import sync_tracker

router = APIRouter(prefix="/api/system", tags=["System Operations & Health"])

@router.get("/health")
def get_system_health(db: Session = Depends(get_db)):
    """
    Returns real-time health diagnostic metrics for all core application services.
    """
    # 1. Database Check
    db_ok = False
    try:
        db.execute(__import__('sqlalchemy').text("SELECT 1")).first()
        db_ok = True
    except Exception:
        db_ok = False

    # 2. Firestore Admin SDK Check
    fs_ok = False
    try:
        from backend.assets.sync_firestore import get_firestore_client
        client = get_firestore_client()
        fs_ok = client is not None
    except Exception:
        fs_ok = False

    # 3. Scheduler Status Check
    scheduler_running = False
    try:
        from backend.scheduler import scheduler
        scheduler_running = scheduler.running
    except Exception:
        scheduler_running = False

    overall_status = "HEALTHY" if (db_ok and fs_ok) else ("DEGRADED" if db_ok else "UNHEALTHY")

    return {
        "status": overall_status,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "environment": os.environ.get("RENDER_SERVICE_ID", "local"),
        "components": {
            "database": {"status": "OPERATIONAL" if db_ok else "ERROR", "type": "SQLite/Postgres"},
            "firestore": {"status": "OPERATIONAL" if fs_ok else "UNAVAILABLE", "type": "Google Cloud Firestore"},
            "scheduler": {"status": "RUNNING" if scheduler_running else "STOPPED", "type": "APScheduler Cron"},
            "sync_engine": {"status": "BUSY" if sync_tracker.is_running else "IDLE", "run_id": sync_tracker.run_id}
        }
    }

@router.get("/metrics")
def get_system_metrics(db: Session = Depends(get_db)):
    """
    Returns system performance and data sync operational metrics.
    """
    total_students = db.query(Student).filter(Student.is_active == True).count()
    
    verified_count = db.query(LeetCodeProfileStats).filter(
        LeetCodeProfileStats.sync_status == "success"
    ).count()

    failed_count = db.query(LeetCodeProfileStats).filter(
        LeetCodeProfileStats.sync_status == "failed"
    ).count()

    mismatch_count = db.query(LeetCodeProfileStats).filter(
        LeetCodeProfileStats.sync_status == "mismatch"
    ).count()

    pending_count = total_students - verified_count - failed_count - mismatch_count
    if pending_count < 0:
        pending_count = 0

    latest_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    return {
        "total_active_students": total_students,
        "verified_profiles_count": verified_count,
        "failed_sync_count": failed_count,
        "identity_mismatch_count": mismatch_count,
        "pending_sync_count": pending_count,
        "data_accuracy_rate_percentage": round((verified_count / max(1, total_students)) * 100.0, 1),
        "latest_weekly_session": {
            "week_number": latest_session.week_number if latest_session else None,
            "session_date": latest_session.session_date if latest_session else None,
            "status": latest_session.status if latest_session else "UPCOMING"
        },
        "sync_tracker": sync_tracker.to_dict()
    }
