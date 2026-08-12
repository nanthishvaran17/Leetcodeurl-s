import datetime
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, SyncJob, SyncJobItem, WeeklySession, WeeklyPublicResult
from backend.leetcode_fetcher import fetch_leetcode_profile
from backend.ranking import update_all_rankings_and_badges
from backend.logger import logger

# In-memory progress tracker for quick polling
class LiveSyncTracker:
    def __init__(self):
        self.current_job_id: Optional[str] = None
        self.is_running: bool = False
        self.total: int = 0
        self.completed: int = 0
        self.success: int = 0
        self.partial: int = 0
        self.failed: int = 0
        self.recent_logs: List[str] = []

    def start(self, job_id: str, total: int):
        self.current_job_id = job_id
        self.is_running = True
        self.total = total
        self.completed = 0
        self.success = 0
        self.partial = 0
        self.failed = 0
        self.recent_logs = []

    def update(self, success_inc=0, partial_inc=0, failed_inc=0, log_msg=""):
        self.completed += 1
        self.success += success_inc
        self.partial += partial_inc
        self.failed += failed_inc
        if log_msg:
            self.recent_logs.append(log_msg)
            if len(self.recent_logs) > 50:
                self.recent_logs.pop(0)

    def finish(self):
        self.is_running = False

sync_tracker = LiveSyncTracker()


async def broadcast_sync_event(event_data: Dict[str, Any]):
    """Broadcasts sync events over WebSocket if manager is available."""
    try:
        from backend.websocket_manager import manager
        await manager.broadcast(event_data)
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")


def get_active_students(db: Session) -> List[Student]:
    """Returns active student roster from database dynamically."""
    return db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()


def start_full_sync_job(db: Session, triggered_by: str = "admin") -> Dict[str, Any]:
    """
    Enforces DB-level single-job lock and starts an asynchronous full sync background worker.
    Returns existing job if one is already RUNNING.
    """
    # 1. DB-Level Single Job Lock Check
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    if running_job:
        logger.info(f"Sync job {running_job.job_id} is already RUNNING. Reusing active job.")
        return {
            "job_id": running_job.job_id,
            "status": "RUNNING",
            "message": "A synchronization job is already in progress.",
            "started_at": running_job.started_at.isoformat() if running_job.started_at else None
        }

    # 2. Dynamic Active Roster Count
    students = get_active_students(db)
    total_count = len(students)

    job_id = f"SYNC-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    new_job = SyncJob(
        job_id=job_id,
        job_type="FULL_SYNC",
        started_at=datetime.datetime.utcnow(),
        status="RUNNING",
        total_records=total_count,
        success_count=0,
        partial_count=0,
        error_count=0,
        triggered_by=triggered_by
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    sync_tracker.start(job_id, total_count)

    # 3. Launch background worker thread/task
    asyncio.create_task(_run_full_sync_worker(job_id))

    return {
        "job_id": job_id,
        "status": "RUNNING",
        "total_records": total_count,
        "message": f"Started live sync job for {total_count} active students."
    }


async def _run_full_sync_worker(job_id: str):
    """
    Asynchronous background worker that executes full roster LeetCode profile refresh,
    field-level merging, audit logging, dynamic contest updates, and rank recalculations.
    """
    logger.info(f"Starting background live sync worker for job_id: {job_id}")
    db = SessionLocal()

    try:
        students = get_active_students(db)
        total_students = len(students)
        success_count = 0
        partial_count = 0
        error_count = 0

        # Concurrent rate-limited execution (batch size = 5)
        batch_size = 5
        for i in range(0, total_students, batch_size):
            batch = students[i:i + batch_size]
            tasks = [fetch_leetcode_profile(s.leetcode_url or s.username) for s in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for student, res in zip(batch, results):
                is_success, is_partial, is_error = _process_single_student_sync(db, job_id, student, res)
                
                if is_success:
                    success_count += 1
                    sync_tracker.update(success_inc=1, log_msg=f"✅ {student.name} ({student.reg_no}) - Fresh live data synced.")
                elif is_partial:
                    partial_count += 1
                    sync_tracker.update(partial_inc=1, log_msg=f"⚠️ {student.name} ({student.reg_no}) - Preserved previous valid data.")
                else:
                    error_count += 1
                    sync_tracker.update(failed_inc=1, log_msg=f"❌ {student.name} ({student.reg_no}) - Sync failed.")

                # Real-time WebSocket Progress Broadcast
                await broadcast_sync_event({
                    "type": "SYNC_PROGRESS",
                    "job_id": job_id,
                    "total": total_students,
                    "completed": sync_tracker.completed,
                    "success": success_count,
                    "partial": partial_count,
                    "failed": error_count,
                    "progress_percentage": round((sync_tracker.completed / max(1, total_students)) * 100.0, 1),
                    "recent_student": f"{student.name} ({student.reg_no})"
                })

            await asyncio.sleep(0.1)  # Gentle rate limiting

        # 4. Dynamic Current Contest Matrix Refresh
        _sync_active_contest_data(db)

        # 5. Recalculate Multi-Level Ranks & Badges
        update_all_rankings_and_badges(db)
        db.commit()

        # 6. Update SyncJob Summary Record
        job_record = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if job_record:
            job_record.completed_at = datetime.datetime.utcnow()
            job_record.success_count = success_count
            job_record.partial_count = partial_count
            job_record.error_count = error_count

            if error_count == 0 and partial_count == 0:
                job_record.status = "COMPLETED"
            elif success_count > 0:
                job_record.status = "COMPLETED_WITH_WARNINGS"
            else:
                job_record.status = "FAILED"

            db.commit()

        sync_tracker.finish()

        # 7. Final Completion WebSocket Broadcast
        await broadcast_sync_event({
            "type": "SYNC_COMPLETED",
            "job_id": job_id,
            "status": job_record.status if job_record else "COMPLETED",
            "total_records": total_students,
            "success_count": success_count,
            "partial_count": partial_count,
            "error_count": error_count,
            "completed_at": datetime.datetime.utcnow().isoformat()
        })
        logger.info(f"Live sync worker completed for job_id: {job_id}. Success: {success_count}, Partial: {partial_count}, Errors: {error_count}")

    except Exception as exc:
        logger.error(f"Critical error during live sync worker {job_id}: {exc}")
        job_record = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if job_record:
            job_record.status = "FAILED"
            job_record.completed_at = datetime.datetime.utcnow()
            db.commit()
        sync_tracker.finish()
    finally:
        db.close()


def _process_single_student_sync(db: Session, job_id: str, student: Student, res: Any) -> Tuple[bool, bool, bool]:
    """
    Performs field-level merger & data preservation rules for a single student.
    Returns (is_success, is_partial, is_error).
    """
    st = student.stats
    if not st:
        st = LeetCodeProfileStats(student_id=student.id)
        db.add(st)

    old_total = st.total_solved
    now = datetime.datetime.utcnow()

    # Case A: Exception or Network Error
    if isinstance(res, Exception) or not isinstance(res, dict):
        err_msg = str(res) if isinstance(res, Exception) else "Unknown fetch error"
        st.error_message = err_msg
        st.error_code = "NETWORK_ERROR"
        st.sync_status = "failed" if old_total is None else "stale"
        st.last_attempt_at = now

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="total_solved",
            status="LAST_VERIFIED" if old_total is not None else "FETCH_ERROR",
            old_value=str(old_total) if old_total is not None else None,
            new_value=str(old_total) if old_total is not None else None,
            error_code="NETWORK_ERROR"
        )
        db.add(item)
        db.commit()
        return (False, old_total is not None, old_total is None)

    # Case B: Standard API Response Parse
    status_str = res.get("status", "pending")
    total_solved = res.get("total_solved")
    easy_solved = res.get("easy_solved")
    medium_solved = res.get("medium_solved")
    hard_solved = res.get("hard_solved")
    contest_rating = res.get("contest_rating")
    global_ranking = res.get("contest_global_ranking")

    if status_str in ("OK", "success", "verified") and total_solved is not None:
        # Calculate derived total
        derived_total = (easy_solved or 0) + (medium_solved or 0) + (hard_solved or 0)
        source_total = total_solved

        st.source_total_solved = source_total
        st.derived_total_solved = derived_total

        # Institutional Total Solved Policy:
        # Use derived_total if easy/medium/hard all successfully returned; otherwise source_total
        if easy_solved is not None and medium_solved is not None and hard_solved is not None:
            st.total_solved = derived_total
        else:
            st.total_solved = source_total

        st.easy_solved = easy_solved if easy_solved is not None else st.easy_solved
        st.medium_solved = medium_solved if medium_solved is not None else st.medium_solved
        st.hard_solved = hard_solved if hard_solved is not None else st.hard_solved

        if contest_rating is not None:
            st.contest_rating = contest_rating
        if global_ranking is not None:
            st.contest_global_ranking = global_ranking

        st.status = "verified"
        st.sync_status = "success"
        st.validation_status = "verified"
        st.source = "leetcode_live_sync"
        st.last_successful_sync = now
        st.last_verified_at = now
        st.last_attempt_at = now
        st.error_message = None
        st.error_code = None

        # Check for data inconsistency between source and derived total
        is_mismatch = (source_total != derived_total) and (derived_total > 0)
        item_status = "DATA_INCONSISTENCY" if is_mismatch else "FRESH"

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="total_solved",
            status=item_status,
            old_value=str(old_total) if old_total is not None else None,
            new_value=str(st.total_solved),
            error_code="MISMATCH_WARNING" if is_mismatch else None
        )
        db.add(item)
        db.commit()
        return (True, False, False)

    else:
        # Fetch failed or profile not found — PRESERVE PREVIOUS VALID DATA
        st.error_message = res.get("error_message") or "Profile fetch failed"
        st.error_code = res.get("error_code") or "FETCH_ERROR"
        st.last_attempt_at = now
        st.sync_status = "stale" if old_total is not None else "failed"

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="total_solved",
            status="LAST_VERIFIED" if old_total is not None else "FETCH_ERROR",
            old_value=str(old_total) if old_total is not None else None,
            new_value=str(old_total) if old_total is not None else None,
            error_code=st.error_code
        )
        db.add(item)
        db.commit()
        return (False, old_total is not None, old_total is None)


def _sync_active_contest_data(db: Session):
    """Refreshes matrix performance data for current active weekly session if present."""
    active_session = db.query(WeeklySession).filter(WeeklySession.status == "LIVE").first()
    if not active_session:
        active_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    if active_session:
        from backend.routes.weekly_contests import get_session_matrix
        get_session_matrix(session_id=active_session.id, dept="ALL", year="ALL", db=db)


def sync_single_student(student_id: int, db: Session) -> Dict[str, Any]:
    """
    Performs single-student instant live refresh.
    Updates DB, logs item audit, recalculates ranks, and broadcasts WebSocket update.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {"status": "error", "message": "Student not found"}

    username = student.username or extract_leetcode_username(student.leetcode_url)[0]
    if not username:
        return {"status": "error", "message": "Student profile URL or username is invalid"}

    # Execute single fetch synchronously/async loop
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    res = loop.run_until_complete(fetch_leetcode_profile(username))

    job_id = f"SINGLE-{student_id}-{int(datetime.datetime.utcnow().timestamp())}"
    is_success, is_partial, is_error = _process_single_student_sync(db, job_id, student, res)

    update_all_rankings_and_badges(db)
    db.commit()
    db.refresh(student)

    # Broadcast WebSocket update for single student
    try:
        loop.create_task(broadcast_sync_event({
            "type": "STUDENT_UPDATED",
            "student_id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "total_solved": student.stats.total_solved if student.stats else None,
            "sync_status": student.stats.sync_status if student.stats else "failed"
        }))
    except Exception:
        pass

    return {
        "status": "success" if is_success else "partial" if is_partial else "error",
        "student_id": student.id,
        "name": student.name,
        "reg_no": student.reg_no,
        "total_solved": student.stats.total_solved if student.stats else None,
        "sync_status": student.stats.sync_status if student.stats else "failed",
        "last_verified_at": student.stats.last_verified_at.isoformat() if (student.stats and student.stats.last_verified_at) else None
    }


def get_system_freshness(db: Session) -> Dict[str, Any]:
    """Returns system-wide freshness metrics and verification summary."""
    students = get_active_students(db)
    total_count = len(students)

    verified_count = 0
    partial_count = 0
    stale_count = 0
    latest_sync: Optional[datetime.datetime] = None

    now = datetime.datetime.utcnow()

    for s in students:
        st = s.stats
        if st and st.sync_status == "success" and st.total_solved is not None:
            verified_count += 1
            if st.last_successful_sync and (latest_sync is None or st.last_successful_sync > latest_sync):
                latest_sync = st.last_successful_sync
            # Check if sync is older than 24 hours
            if st.last_successful_sync and (now - st.last_successful_sync).total_seconds() > 86400:
                stale_count += 1
        elif st and st.total_solved is not None:
            partial_count += 1
        else:
            stale_count += 1

    needs_attention = partial_count + stale_count

    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()

    return {
        "total_students": total_count,
        "verified_count": verified_count,
        "partial_count": partial_count,
        "stale_count": stale_count,
        "needs_attention_count": needs_attention,
        "last_successful_sync": latest_sync.isoformat() if latest_sync else None,
        "is_sync_running": running_job is not None,
        "running_job_id": running_job.job_id if running_job else None,
        "freshness_badge": f"🟢 {verified_count}/{total_count} Verified | ⚠️ {needs_attention} Need Attention"
    }
