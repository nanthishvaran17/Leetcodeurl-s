from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import SyncJob, SyncJobItem, Student
from backend.services.live_sync_service import (
    start_full_sync_job,
    sync_single_student,
    get_system_freshness,
    sync_tracker
)

router = APIRouter(tags=["Live Sync Engine"])

@router.post("/api/sync/full")
async def trigger_full_sync(triggered_by: str = Query("admin"), db: Session = Depends(get_db)):
    """
    Triggers institutional full roster live sync.
    Enforces DB-level single-job lock and returns job_id immediately without blocking.
    """
    result = start_full_sync_job(db, triggered_by=triggered_by)
    return result


@router.get("/api/sync/status")
def get_current_sync_status(db: Session = Depends(get_db)):
    """
    Returns real-time sync progress status and tracker state.
    """
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    comp = sync_tracker.completed
    if running_job and comp == 0:
        comp = (running_job.success_count or 0) + (running_job.partial_count or 0) + (running_job.error_count or 0)

    tot = sync_tracker.total or (running_job.total_records if running_job else 273)
    succ = sync_tracker.success or (running_job.success_count if running_job else 0)
    part = sync_tracker.partial or (running_job.partial_count if running_job else 0)
    fail = sync_tracker.failed or (running_job.error_count if running_job else 0)

    return {
        "is_running": sync_tracker.is_running or (running_job is not None),
        "job_id": running_job.job_id if running_job else sync_tracker.current_job_id,
        "total": tot,
        "completed": comp,
        "processed": comp,
        "success": succ,
        "partial": part,
        "failed": fail,
        "percentage": round((comp / max(1, tot)) * 100.0, 1),
        "recent_logs": sync_tracker.recent_logs[-10:] if sync_tracker.recent_logs else []
    }


@router.get("/api/sync/jobs/{job_id}")
def get_sync_job_details(job_id: str, db: Session = Depends(get_db)):
    """
    Retrieves summary for a specific sync job ID.
    """
    job = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job '{job_id}' not found")
    return {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "status": job.status,
        "total_records": job.total_records,
        "success_count": job.success_count,
        "partial_count": job.partial_count,
        "error_count": job.error_count,
        "triggered_by": job.triggered_by
    }


@router.get("/api/sync/jobs/{job_id}/items")
def get_sync_job_items(
    job_id: str, 
    limit: int = Query(100, ge=1, le=500), 
    db: Session = Depends(get_db)
):
    """
    Retrieves audit log items for a sync job, showing old_value -> new_value changes and field status.
    """
    items = db.query(SyncJobItem).filter(SyncJobItem.job_id == job_id).order_by(SyncJobItem.id.desc()).limit(limit).all()
    return [{
        "id": it.id,
        "job_id": it.job_id,
        "student_id": it.student_id,
        "field": it.field,
        "status": it.status,
        "old_value": it.old_value,
        "new_value": it.new_value,
        "error_code": it.error_code,
        "completed_at": it.completed_at.isoformat() if it.completed_at else None
    } for it in items]


@router.post("/api/sync/student/{student_id}")
def trigger_single_student_sync(student_id: int, db: Session = Depends(get_db)):
    """
    Performs single-student instant live refresh.
    Refreshes student stats, logs audit item, recalculates ranks, and returns updated student data.
    """
    res = sync_single_student(student_id, db)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message", "Sync failed"))
    return res


@router.post("/api/sync/contest/{session_id}")
def trigger_contest_session_sync(session_id: int, db: Session = Depends(get_db)):
    """
    Triggers live synchronization for a specific weekly contest session.
    """
    from backend.routes.weekly_contests import get_session_matrix
    result = get_session_matrix(session_id=session_id, dept="ALL", year="ALL", db=db)
    return {
        "status": "success",
        "session_id": session_id,
        "total_matrix_rows": len(result.get("rows", []))
    }


@router.get("/api/data/freshness")
def get_data_freshness_metadata(db: Session = Depends(get_db)):
    """
    Retrieves system-wide data freshness metadata, last sync timestamp, and status badges.
    """
    return get_system_freshness(db)
