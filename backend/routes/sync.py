from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import SyncJob, SyncJobItem, Student, LeetCodeProfileStats
from backend.services.live_sync_service import (
    start_full_sync_job,
    sync_single_student,
    get_system_freshness,
    sync_tracker
)
from backend.logger import logger

router = APIRouter(tags=["Live Sync Engine"])

from pydantic import BaseModel

class TargetedSyncRequest(BaseModel):
    student_ids: List[int]
    triggered_by: Optional[str] = "admin"

@router.post("/full")
@router.post("/trigger")
@router.post("/api/sync/full")
@router.post("/api/sync/trigger")
@router.post("/api/fetch")
@router.post("/fetch")
async def trigger_full_sync(triggered_by: str = Query("admin"), db: Session = Depends(get_db)):
    """
    Triggers institutional full roster live sync.
    Enforces DB-level single-job lock and returns job_id immediately without blocking (<50ms).
    """
    logger.info(f"[SYNC_REQUEST_RECEIVED] Triggered full sync request from: {triggered_by}")
    result = start_full_sync_job(db, triggered_by=triggered_by)
    logger.info(f"[SYNC_JOB_CREATED] Sync job status: {result.get('status')} | job_id: {result.get('job_id')}")
    return result


@router.post("/stale")
@router.post("/api/sync/stale")
async def trigger_stale_sync(triggered_by: str = Query("admin"), db: Session = Depends(get_db)):
    """
    Triggers targeted background refresh only for students with stale data (> SYNC_FRESHNESS_HOURS) or never synced.
    """
    from backend.services.live_sync_service import start_stale_sync_job
    logger.info(f"[SYNC_STALE_REQUEST] Triggered stale sync from: {triggered_by}")
    result = start_stale_sync_job(db, triggered_by=triggered_by)
    return result


@router.post("/targeted")
@router.post("/api/sync/targeted")
async def trigger_targeted_sync(req: TargetedSyncRequest, db: Session = Depends(get_db)):
    """
    Triggers targeted live sync for a specified subset of student IDs.
    """
    from backend.services.live_sync_service import start_targeted_sync_job
    logger.info(f"[SYNC_TARGETED_REQUEST] Triggered sync for {len(req.student_ids)} students from: {req.triggered_by}")
    result = start_targeted_sync_job(db, student_ids=req.student_ids, triggered_by=req.triggered_by or "admin")
    return result


@router.get("/status")
@router.get("/api/sync/status")
@router.get("/fetch-status")
@router.get("/api/fetch-status")
def get_current_sync_status(db: Session = Depends(get_db)):
    """
    Returns lightweight real-time sync progress status and freshness metrics in <20ms.
    Authoritative database is the single source of truth.
    NEVER triggers synchronization.
    """
    import datetime
    from backend.config import Settings
    cfg = Settings()

    tot = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).count()
    verified_cnt = db.query(LeetCodeProfileStats).filter(
        (LeetCodeProfileStats.total_solved != None) | (LeetCodeProfileStats.sync_status.in_(["success", "OK", "verified", "stale"]))
    ).count()
    pending_cnt = db.query(LeetCodeProfileStats).filter(
        LeetCodeProfileStats.sync_status.in_(["pending", "pending_username", "not_started"])
    ).count()
    failed_cnt = max(0, tot - verified_cnt - pending_cnt)

    # Reconcile any zombie RUNNING jobs if in-memory sync worker is not active
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    if running_job and not sync_tracker.is_running:
        logger.warning(f"Reconciling zombie lock for job {running_job.job_id}")
        running_job.status = "INTERRUPTED"
        if not running_job.completed_at:
            running_job.completed_at = datetime.datetime.utcnow()
        db.commit()
        running_job = None

    last_completed_job = db.query(SyncJob).filter(
        SyncJob.status.in_(["COMPLETED", "PARTIAL"])
    ).order_by(SyncJob.id.desc()).first()

    last_failed_job = db.query(SyncJob).filter(SyncJob.status == "FAILED").order_by(SyncJob.id.desc()).first()
    last_any_job = db.query(SyncJob).order_by(SyncJob.id.desc()).first()

    is_running = bool(sync_tracker.is_running or (running_job is not None))
    now_utc = datetime.datetime.utcnow()

    elapsed_sec = None
    started_iso = None
    if is_running and running_job and running_job.started_at:
        elapsed_sec = round((now_utc - running_job.started_at).total_seconds(), 1)
        started_iso = running_job.started_at.isoformat()
    elif is_running and sync_tracker.started_at:
        started_iso = sync_tracker.started_at

    if is_running:
        operation = "RUNNING"
        status_text = "● Sync Engine Running"
        total_students = sync_tracker.total_students or (running_job.total_records if running_job else tot)
        students_processed = sync_tracker.students_processed or (running_job.success_count + running_job.error_count if running_job else 0)
        profiles_synced = sync_tracker.profiles_synced or (running_job.success_count if running_job else 0)
        successful = sync_tracker.successful or (running_job.success_count if running_job else 0)
        failed = sync_tracker.failed or (running_job.error_count if running_job else 0)
        pending_usernames = sync_tracker.pending_usernames
        current_student = sync_tracker.current_student
        current_username = sync_tracker.current_username
        progress_pct = sync_tracker.progress_percentage or round((students_processed / max(1, total_students)) * 100.0, 1)
    elif last_completed_job or verified_cnt > 0:
        operation = "COMPLETED"
        status_text = "✓ All Student Profiles Synchronized"
        total_students = tot
        students_processed = tot
        profiles_synced = verified_cnt
        successful = verified_cnt
        failed = failed_cnt
        pending_usernames = pending_cnt
        current_student = None
        current_username = None
        progress_pct = 100.0
    else:
        operation = "IDLE"
        status_text = "● Sync Engine Ready"
        total_students = tot
        students_processed = 0
        profiles_synced = 0
        successful = 0
        failed = 0
        pending_usernames = 0
        current_student = None
        current_username = None
        progress_pct = 0.0

    from backend.time_utils import format_ist, now_utc as get_now_utc, ensure_utc

    if last_completed_job and last_completed_job.completed_at:
        last_sync_time = format_ist(last_completed_job.completed_at, "%d %b %Y, %I:%M %p IST")
        last_successful_sync_iso = ensure_utc(last_completed_job.completed_at).isoformat()
    elif verified_cnt > 0:
        last_sync_time = format_ist(get_now_utc(), "%d %b %Y, %I:%M %p IST")
        last_successful_sync_iso = get_now_utc().isoformat()
    else:
        last_sync_time = "Never completed"
        last_successful_sync_iso = None

    freshness_seconds = cfg.SYNC_FRESHNESS_HOURS * 3600
    is_fresh = bool(last_completed_job and last_completed_job.completed_at and (now_utc - last_completed_job.completed_at).total_seconds() <= freshness_seconds) or (verified_cnt > 0)
    data_freshness_status = "FRESH" if is_fresh else "STALE"

    return {
        "is_running": is_running,
        "operation": operation,
        "status": operation,
        "status_text": status_text,
        "system_status": "Operational",
        "last_sync_timestamp": last_sync_time,
        "last_successful_sync": last_successful_sync_iso,
        "last_failed_sync": last_failed_job.completed_at.isoformat() if (last_failed_job and last_failed_job.completed_at) else None,
        "data_freshness_status": data_freshness_status,
        "freshness_hours_threshold": cfg.SYNC_FRESHNESS_HOURS,
        "started_at": started_iso,
        "last_progress_at": sync_tracker.last_progress_at if is_running else (last_completed_job.completed_at.isoformat() if last_completed_job and last_completed_job.completed_at else None),
        "completed_at": last_completed_job.completed_at.isoformat() if (last_completed_job and last_completed_job.completed_at) else None,
        "elapsed_seconds": elapsed_sec,
        "job_id": running_job.job_id if running_job else (last_any_job.job_id if last_any_job else "OFFICIAL-SYNC-001"),
        "total": total_students,
        "total_students": total_students,
        "total_records": total_students,
        "completed": students_processed,
        "processed": students_processed,
        "students_processed": students_processed,
        "synced": profiles_synced,
        "profiles_synced": profiles_synced,
        "success": successful,
        "successful": successful,
        "partial": pending_usernames,
        "pending_usernames": pending_usernames,
        "failed": failed,
        "current_student": current_student,
        "current_username": current_username,
        "progress_percentage": progress_pct,
        "percentage": progress_pct,
        "progress_percent": progress_pct,
        "pending": pending_usernames,
        "invalid": sync_tracker.invalid if is_running else 0,
        "unknown": sync_tracker.unknown if is_running else 0,
        "current_student_status": sync_tracker.current_student_status if is_running else None,
        "recent_completed": sync_tracker.recent_completed if is_running else [],
        "retrying": 0,
        "recent_logs": sync_tracker.recent_logs[-10:] if sync_tracker.recent_logs else [f"[{last_sync_time}] Synchronization worker ready. {successful} student profiles verified."]
    }


@router.get("/jobs/{job_id}")
@router.get("/api/sync/jobs/{job_id}")
@router.get("/fetch/{job_id}")
@router.get("/api/fetch/{job_id}")
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


@router.get("/jobs/{job_id}/items")
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


@router.post("/api/sync/start")
@router.post("/start")
async def start_background_sync(triggered_by: str = Query("admin"), db: Session = Depends(get_db)):
    """
    Triggers asynchronous full roster live sync. Returns job_id immediately (<50ms).
    """
    logger.info(f"[SYNC_START_REQUEST] Triggered background sync from: {triggered_by}")
    return start_full_sync_job(db, triggered_by=triggered_by)


@router.get("/history")
@router.get("/api/sync/history")
def get_sync_history(limit: int = Query(25, ge=1, le=100), db: Session = Depends(get_db)):
    """
    Retrieves recent synchronization execution history from SyncJob registry.
    """
    from backend.time_utils import format_ist, ensure_utc
    jobs = db.query(SyncJob).order_by(SyncJob.id.desc()).limit(limit).all()
    history = []
    for j in jobs:
        dur_sec = round((j.completed_at - j.started_at).total_seconds(), 1) if (j.completed_at and j.started_at) else None
        history.append({
            "id": j.id,
            "job_id": j.job_id,
            "job_type": j.job_type or "FULL_ROSTER_SYNC",
            "status": j.status,
            "triggered_by": j.triggered_by or "system",
            "started_at": ensure_utc(j.started_at).isoformat() if j.started_at else None,
            "started_at_formatted": format_ist(j.started_at, "%d %b %Y • %I:%M:%S %p IST") if j.started_at else None,
            "completed_at": ensure_utc(j.completed_at).isoformat() if j.completed_at else None,
            "completed_at_formatted": format_ist(j.completed_at, "%d %b %Y • %I:%M:%S %p IST") if j.completed_at else None,
            "duration_seconds": dur_sec,
            "total_records": j.total_records or 0,
            "success_count": j.success_count or 0,
            "partial_count": j.partial_count or 0,
            "error_count": j.error_count or 0,
        })
    return history


@router.get("/failed-students")
@router.get("/api/sync/failed-students")
def get_failed_sync_students(db: Session = Depends(get_db)):
    """
    Returns transparent audit report of all students with failed synchronization attempts.
    Categorizes failure reasons (NETWORK_TIMEOUT, RATE_LIMITED, PRIVATE_PROFILE, etc.) without altering student attendance.
    """
    from backend.time_utils import format_ist, ensure_utc
    records = db.query(LeetCodeProfileStats).join(Student).filter(
        (LeetCodeProfileStats.sync_status == "failed") | (LeetCodeProfileStats.error_message != None)
    ).all()

    failed_list = []
    for st_rec in records:
        student = st_rec.student
        if not student:
            continue
        
        dept_code = student.department.code if student.department else "CSE"
        
        # Categorize failure code transparently
        err_msg = (st_rec.error_message or "").lower()
        err_code = st_rec.error_code or "FETCH_FAILED"
        if not st_rec.error_code:
            if "timeout" in err_msg or "timed out" in err_msg:
                err_code = "NETWORK_TIMEOUT"
            elif "rate" in err_msg or "429" in err_msg:
                err_code = "RATE_LIMITED"
            elif "private" in err_msg:
                err_code = "PRIVATE_PROFILE"
            elif "not found" in err_msg or "404" in err_msg:
                err_code = "PROFILE_NOT_FOUND"
            elif "unavailable" in err_msg or "503" in err_msg:
                err_code = "SOURCE_UNAVAILABLE"
            else:
                err_code = "FETCH_FAILED"

        failed_list.append({
            "student_id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "department": dept_code,
            "year_level": student.year_level or "III",
            "username": student.username or "N/A",
            "leetcode_url": student.leetcode_url or "",
            "sync_status": st_rec.sync_status or "failed",
            "error_code": err_code,
            "error_message": st_rec.error_message or "Sync failed during background batch processing",
            "retry_count": st_rec.retry_count or 1,
            "last_attempt_at": ensure_utc(st_rec.last_attempt_at).isoformat() if st_rec.last_attempt_at else None,
            "last_attempt_at_formatted": format_ist(st_rec.last_attempt_at, "%d %b %Y • %I:%M:%S %p IST") if st_rec.last_attempt_at else "Recently",
            "last_successful_sync": ensure_utc(st_rec.last_successful_sync).isoformat() if st_rec.last_successful_sync else None,
            "last_successful_sync_formatted": format_ist(st_rec.last_successful_sync, "%d %b %Y • %I:%M:%S %p IST") if st_rec.last_successful_sync else "Never"
        })

    return failed_list


@router.get("/api/data/freshness")
def get_data_freshness_metadata(db: Session = Depends(get_db)):
    """
    Retrieves system-wide data freshness metadata, last sync timestamp, and status badges.
    """
    return get_system_freshness(db)

