import datetime
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, SyncJob, SyncJobItem, WeeklySession, WeeklyPublicResult, StudentStatSnapshot, StudentContestSnapshot
from backend.leetcode_fetcher import fetch_leetcode_profile
from backend.ranking import update_all_rankings_and_badges
from backend.logger import logger

# In-memory progress tracker for quick polling
class LiveSyncTracker:
    def __init__(self):
        self.current_job_id: Optional[str] = None
        self.is_running: bool = False
        self.status: str = "IDLE"
        self.total_students: int = 0
        self.students_processed: int = 0
        self.profiles_synced: int = 0
        self.successful: int = 0
        self.partial: int = 0
        self.failed: int = 0
        self.pending_usernames: int = 0
        self.current_student: Optional[str] = None
        self.current_username: Optional[str] = None
        self.progress_percentage: float = 0.0
        self.started_at: Optional[str] = None
        self.last_progress_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.last_successful_sync: Optional[str] = None
        self.recent_logs: List[str] = []
        self.error_summary: Optional[str] = None

    @property
    def total(self) -> int:
        return self.total_students

    @property
    def completed(self) -> int:
        return self.students_processed

    @property
    def success(self) -> int:
        return self.successful

    def start(self, job_id: str, total: int):
        now_iso = datetime.datetime.utcnow().isoformat()
        self.current_job_id = job_id
        self.is_running = True
        self.status = "RUNNING"
        self.total_students = total
        self.students_processed = 0
        self.profiles_synced = 0
        self.successful = 0
        self.partial = 0
        self.failed = 0
        self.pending_usernames = 0
        self.current_student = None
        self.current_username = None
        self.progress_percentage = 0.0
        self.started_at = now_iso
        self.last_progress_at = now_iso
        self.completed_at = None
        self.error_summary = None
        self.recent_logs = [f"[WORKER] Live sync worker started for {total} active students."]

    def set_current(self, student_name: str, username: Optional[str] = None):
        self.current_student = student_name
        self.current_username = username or ""
        self.last_progress_at = datetime.datetime.utcnow().isoformat()

    def update(self, success_inc=0, profiles_synced_inc=0, partial_inc=0, failed_inc=0, pending_inc=0, log_msg=""):
        self.students_processed += 1
        self.profiles_synced += profiles_synced_inc
        self.successful += success_inc
        self.partial += partial_inc
        self.failed += failed_inc
        self.pending_usernames += pending_inc
        self.last_progress_at = datetime.datetime.utcnow().isoformat()
        self.progress_percentage = round((self.students_processed / max(1, self.total_students)) * 100.0, 2)
        if log_msg:
            self.recent_logs.append(log_msg)
            if len(self.recent_logs) > 50:
                self.recent_logs.pop(0)

    def finish(self, status: str = "COMPLETED", error_summary: Optional[str] = None):
        self.is_running = False
        self.status = status
        self.completed_at = datetime.datetime.utcnow().isoformat()
        if status in ("COMPLETED", "PARTIAL"):
            self.last_successful_sync = self.completed_at
        self.error_summary = error_summary
        self.current_student = None
        self.current_username = None

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
    logger.info("[SYNC] Loading active institutional student roster from database...")
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    logger.info(f"[SYNC] Loaded {len(students)} active students")
    return students


import threading

def dispatch_background_task(coro):
    """Dispatches async coroutine task reliably and non-blockingly (<10ms) across all execution contexts."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        t = threading.Thread(target=asyncio.run, args=(coro,), daemon=True)
        t.start()


from backend.config import Settings
settings = Settings()

def start_full_sync_job(db: Session, triggered_by: str = "admin") -> Dict[str, Any]:
    """
    Enforces DB-level single-job lock and starts an asynchronous full sync background worker.
    Returns existing job if one is already RUNNING.
    """
    # 1. DB-Level Single Job Lock Check
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    if running_job:
        if not sync_tracker.is_running:
            logger.warning(f"Sync job {running_job.job_id} was marked RUNNING in DB but worker is inactive. Cleaning up zombie lock.")
            running_job.status = "INTERRUPTED"
            running_job.completed_at = datetime.datetime.utcnow()
            db.commit()
            running_job = None
        else:
            logger.info(f"[SYNC] Sync job {running_job.job_id} is already RUNNING. Reusing active job.")
            return {
                "success": False,
                "status": "SYNC_ALREADY_RUNNING",
                "job_id": running_job.job_id,
                "message": "A synchronization job is already in progress.",
                "started_at": running_job.started_at.isoformat() if running_job.started_at else None
            }

    # 2. Dynamic Active Roster Count
    students = get_active_students(db)
    total_count = len(students)

    job_id = f"SYNC-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    logger.info(f"[SYNC] Creating session: {job_id}")
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
    logger.info(f"[QUEUE] Job queued: {job_id}")

    sync_tracker.start(job_id, total_count)

    # 3. Launch background worker task reliably
    dispatch_background_task(_run_full_sync_worker(job_id))

    return {
        "success": True,
        "job_id": job_id,
        "status": "SYNCING",
        "total_records": total_count,
        "message": f"Started background live sync job for {total_count} active students."
    }


def start_stale_sync_job(db: Session, triggered_by: str = "admin") -> Dict[str, Any]:
    """
    Synchronizes only stale student profiles (older than SYNC_FRESHNESS_HOURS) or never synced.
    """
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    if running_job and sync_tracker.is_running:
        return {
            "success": False,
            "status": "SYNC_ALREADY_RUNNING",
            "job_id": running_job.job_id,
            "message": "A synchronization job is already in progress."
        }

    now = datetime.datetime.utcnow()
    freshness_seconds = settings.SYNC_FRESHNESS_HOURS * 3600
    threshold = now - datetime.timedelta(seconds=freshness_seconds)

    stale_students = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id).filter(
        ((Student.is_active == True) | (Student.is_active.is_(None))) &
        ((LeetCodeProfileStats.id.is_(None)) | 
         (LeetCodeProfileStats.last_successful_sync.is_(None)) | 
         (LeetCodeProfileStats.last_successful_sync < threshold) |
         (LeetCodeProfileStats.sync_status == "failed"))
    ).all()

    if not stale_students:
        return {
            "success": True,
            "status": "FRESH",
            "job_id": None,
            "total_records": 0,
            "message": f"All student profiles are already fresh (synced within last {settings.SYNC_FRESHNESS_HOURS} hours)."
        }

    job_id = f"SYNC-STALE-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    target_ids = [s.id for s in stale_students]
    total_count = len(target_ids)

    new_job = SyncJob(
        job_id=job_id,
        job_type="STALE_SYNC",
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

    sync_tracker.start(job_id, total_count)
    dispatch_background_task(_run_full_sync_worker(job_id, target_student_ids=target_ids))

    return {
        "success": True,
        "job_id": job_id,
        "status": "SYNCING",
        "total_records": total_count,
        "message": f"Started targeted background sync for {total_count} stale student profiles."
    }


def start_targeted_sync_job(db: Session, student_ids: List[int], triggered_by: str = "admin") -> Dict[str, Any]:
    """
    Synchronizes only a specific allowlisted subset of student IDs (e.g. after username mapping update).
    """
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()
    if running_job and sync_tracker.is_running:
        return {
            "success": False,
            "status": "SYNC_ALREADY_RUNNING",
            "job_id": running_job.job_id,
            "message": "A synchronization job is already in progress."
        }

    valid_students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    if not valid_students:
        return {"success": False, "status": "ERROR", "message": "No valid matching students found for targeted sync."}

    job_id = f"SYNC-TARGET-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    total_count = len(valid_students)

    new_job = SyncJob(
        job_id=job_id,
        job_type="TARGETED_SYNC",
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

    sync_tracker.start(job_id, total_count)
    dispatch_background_task(_run_full_sync_worker(job_id, target_student_ids=[s.id for s in valid_students]))

    return {
        "success": True,
        "job_id": job_id,
        "status": "SYNCING",
        "total_records": total_count,
        "message": f"Started targeted sync for {total_count} specified students."
    }


from backend.leetcode_fetcher import extract_leetcode_username

async def _run_full_sync_worker(job_id: str, target_student_ids: Optional[List[int]] = None):
    """
    Asynchronous background worker that delegates to the canonical sync pipeline.
    Runs batched multi-phase fetch, updates database, recalculates rankings, and broadcasts progress.
    """
    logger.info(f"[WORKER] Worker started for job: {job_id}")
    from backend.services.canonical_sync_pipeline import run_full_pipeline

    db = SessionLocal()
    try:
        summary = await run_full_pipeline(
            job_id=job_id,
            student_ids=target_student_ids,
            progress_callback=sync_tracker,
            run_optional_phases=True
        )

        final_status = "COMPLETED" if summary.get("fetch_failed", 0) == 0 else "PARTIAL"
        job_record = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if job_record:
            job_record.completed_at = datetime.datetime.utcnow()
            job_record.success_count = summary.get("full_dataset_synced", 0)
            job_record.partial_count = summary.get("partial_sync", 0) + summary.get("pending_username", 0)
            job_record.error_count = summary.get("fetch_failed", 0) + summary.get("invalid_username", 0)
            job_record.status = final_status
            db.commit()

        await broadcast_sync_event({
            "type": "SYNC_COMPLETED",
            "job_id": job_id,
            "status": final_status,
            "summary": summary
        })

    except Exception as exc:
        logger.error(f"[WORKER] Job {job_id} failed: {exc}", exc_info=True)
        job_record = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if job_record:
            job_record.completed_at = datetime.datetime.utcnow()
            job_record.status = "FAILED"
            db.commit()
    finally:
        db.close()


        # Invalidate all caches so dashboard and leaderboard immediately serve fresh data
        try:
            from backend.cache import cache
            cache.clear()
            logger.info("[SYNC] Application cache invalidated post-sync.")
        except Exception as c_err:
            logger.warning(f"[SYNC] Cache invalidation note: {c_err}")

        # 8. Final Completion WebSocket Broadcast
        await broadcast_sync_event({
            "type": "SYNC_COMPLETED",
            "job_id": job_id,
            "status": final_status,
            "total_records": total_students,
            "total_students": total_students,
            "students_processed": sync_tracker.students_processed,
            "profiles_synced": profiles_synced_count,
            "success_count": success_count,
            "successful": success_count,
            "partial_count": partial_count,
            "pending_usernames": pending_username_count,
            "error_count": error_count,
            "failed": error_count,
            "completed_at": datetime.datetime.utcnow().isoformat()
        })
        logger.info(f"[WORKER] Sync completed: Job {job_id}. Total: {total_students}, Successful: {success_count}, Profiles Synced: {profiles_synced_count}, Pending Usernames: {pending_username_count}, Failed: {error_count}")

    except Exception as exc:
        logger.error(f"[WORKER] Critical error during live sync worker {job_id}: {exc}")
        job_record = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if job_record:
            job_record.status = "FAILED"
            job_record.completed_at = datetime.datetime.utcnow()
            db.commit()
        sync_tracker.finish(status="FAILED", error_summary=str(exc))
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

    # Case A: Exception or Network Error - PRESERVE PREVIOUS VALID SNAPSHOT
    if isinstance(res, Exception) or not isinstance(res, dict):
        err_msg = str(res) if isinstance(res, Exception) else "Unknown fetch error"
        st.error_message = err_msg
        st.error_code = "NETWORK_ERROR"
        has_prev_data = (old_total is not None and old_total > 0)
        st.sync_status = "stale" if has_prev_data else "failed"
        st.validation_status = "verified" if has_prev_data else "failed"
        st.last_attempt_at = now

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="total_solved",
            status="LAST_VERIFIED" if has_prev_data else "FETCH_ERROR",
            old_value=str(old_total) if old_total is not None else None,
            new_value=str(old_total) if old_total is not None else None,
            error_code="NETWORK_ERROR"
        )
        db.add(item)
        db.commit()
        return (False, has_prev_data, not has_prev_data)

    # Case B: Explicit Invalid Username (404 on LeetCode)
    status_str = res.get("status", "pending")
    if status_str == "INVALID_USERNAME":
        st.status = "INVALID_USERNAME"
        st.sync_status = "invalid_username"
        st.validation_status = "invalid_username"
        st.error_message = res.get("error_message") or "LeetCode username does not resolve (404)"
        st.error_code = "INVALID_USERNAME"
        st.total_solved = None
        st.easy_solved = None
        st.medium_solved = None
        st.hard_solved = None
        st.contest_rating = None
        st.contest_global_ranking = None
        st.public_profile_ranking = None
        st.last_attempt_at = now
        student.leetcode_url = None

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="username",
            status="INVALID_USERNAME",
            old_value=str(old_total) if old_total is not None else None,
            new_value=None,
            error_code="INVALID_USERNAME"
        )
        db.add(item)
        db.commit()
        return (False, False, True)

    # Case C: Identity Mismatch
    if status_str == "IDENTITY_MISMATCH":
        st.status = "IDENTITY_MISMATCH"
        st.sync_status = "identity_mismatch"
        st.validation_status = "identity_mismatch"
        st.error_message = res.get("error_message") or "Returned LeetCode identity does not match requested identity"
        st.error_code = "IDENTITY_MISMATCH"
        st.total_solved = None
        st.easy_solved = None
        st.medium_solved = None
        st.hard_solved = None
        st.contest_rating = None
        st.contest_global_ranking = None
        st.public_profile_ranking = None
        st.last_attempt_at = now
        student.leetcode_url = None

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="username",
            status="IDENTITY_MISMATCH",
            old_value=str(old_total) if old_total is not None else None,
            new_value=None,
            error_code="IDENTITY_MISMATCH"
        )
        db.add(item)
        db.commit()
        return (False, False, True)

    # Case D: Verified Profile Data
    total_solved = res.get("total_solved")
    easy_solved = res.get("easy_solved")
    medium_solved = res.get("medium_solved")
    hard_solved = res.get("hard_solved")
    contest_rating = res.get("contest_rating")
    global_ranking = res.get("contest_global_ranking")

    if status_str in ("OK", "success", "verified", "PROFILE_VERIFIED") and total_solved is not None:
        # Rule 2: Save verified canonical username & URL
        if res.get("username"):
            student.username = res.get("username")
        if res.get("profile_url"):
            student.leetcode_url = res.get("profile_url")

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

        st.recent_contest_name = res.get("recent_contest_name")
        st.recent_contest_score = res.get("recent_contest_score")
        st.public_profile_ranking = res.get("public_profile_ranking")
        st.contest_rating = contest_rating
        st.contest_global_ranking = global_ranking

        # Create historical StudentContestSnapshot if contest data is present
        if res.get("recent_contest_name"):
            q_solved_int = 0
            q_total_int = 4
            if res.get("recent_contest_score") and " / " in res["recent_contest_score"]:
                try:
                    parts = res["recent_contest_score"].split(" / ")
                    q_solved_int = int(parts[0].strip())
                    q_total_int = int(parts[1].strip())
                except Exception:
                    pass
            c_snap = StudentContestSnapshot(
                student_id=student.id,
                contest_name=res.get("recent_contest_name"),
                questions_solved=q_solved_int,
                questions_total=q_total_int,
                contest_rank=st.contest_global_ranking,
                contest_rating=st.contest_rating,
                top_percentage=res.get("top_percentage"),
                attended=True,
                status="VERIFIED",
                captured_at=now
            )
            db.add(c_snap)

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

        # Create a NEW immutable historical snapshot record for every successful fetch
        snapshot = StudentStatSnapshot(
            student_id=student.id,
            total_solved=st.total_solved,
            easy_solved=st.easy_solved,
            medium_solved=st.medium_solved,
            hard_solved=st.hard_solved,
            contest_rating=st.contest_rating,
            global_rank=st.contest_global_ranking,
            captured_at=now,
            sync_run_id=job_id,
            source="leetcode_live_sync"
        )
        db.add(snapshot)
        db.commit()

        # Update persistent stats in Cloud Firestore & Firebase Realtime Database
        try:
            from backend.services.firestore_service import update_firestore_doc
            fs_data = {
                "student_id": student.id,
                "register_no": student.reg_no,
                "username": student.username,
                "total_solved": st.total_solved,
                "easy_solved": st.easy_solved,
                "medium_solved": st.medium_solved,
                "hard_solved": st.hard_solved,
                "contest_rating": st.contest_rating,
                "contest_global_ranking": st.contest_global_ranking,
                "public_profile_ranking": st.public_profile_ranking,
                "sync_status": "verified",
                "status": "verified",
                "source": "leetcode_live_sync",
                "last_verified_at": now.isoformat() + "Z"
            }
            update_firestore_doc("leetcode_stats", student.reg_no, fs_data)
            logger.info(f"[SYNC_DATABASE_WRITE] Written Cloud Firestore profile stats for {student.reg_no}")
        except Exception as fs_err:
            logger.warning(f"[SYNC] Cloud Firestore stats update note for {student.reg_no}: {fs_err}")

        try:
            from backend.services.firebase_rtdb_service import get_rtdb_reference
            reg_key = str(student.reg_no).replace('.', '_').replace('#', '_').replace('$', '_').replace('[', '_').replace(']', '_')
            rtdb_stat = get_rtdb_reference(f"leetcode_stats/{reg_key}")
            if rtdb_stat:
                rtdb_stat.update({
                    "student_id": student.id,
                    "reg_no": student.reg_no,
                    "username": student.username,
                    "total_solved": st.total_solved,
                    "easy_solved": st.easy_solved,
                    "medium_solved": st.medium_solved,
                    "hard_solved": st.hard_solved,
                    "contest_rating": st.contest_rating,
                    "contest_global_ranking": st.contest_global_ranking,
                    "public_profile_ranking": st.public_profile_ranking,
                    "sync_status": "verified",
                    "status": "verified",
                    "source": "leetcode_live_sync",
                    "last_verified_at": now.isoformat() + "Z"
                })
        except Exception as rtdb_err:
            logger.warning(f"[SYNC] RTDB stats update note for {student.reg_no}: {rtdb_err}")

        return (True, False, False)

    else:
        # Case E: Generic Fetch Error
        st.error_message = res.get("error_message") or "Profile fetch failed"
        st.error_code = res.get("error_code") or "FETCH_ERROR"
        st.last_attempt_at = now
        st.sync_status = "failed"
        st.status = "FETCH_FAILED"

        item = SyncJobItem(
            job_id=job_id,
            student_id=student.id,
            field="total_solved",
            status="FETCH_ERROR",
            old_value=str(old_total) if old_total is not None else None,
            new_value=None,
            error_code=st.error_code
        )
        db.add(item)
        db.commit()
        return (False, False, True)


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
    freshness_seconds = settings.SYNC_FRESHNESS_HOURS * 3600

    for s in students:
        st = s.stats
        if st and st.sync_status in ("success", "verified") and st.total_solved is not None:
            verified_count += 1
            if st.last_successful_sync and (latest_sync is None or st.last_successful_sync > latest_sync):
                latest_sync = st.last_successful_sync
            # Check if sync is older than configurable threshold
            if st.last_successful_sync and (now - st.last_successful_sync).total_seconds() > freshness_seconds:
                stale_count += 1
        elif st and st.total_solved is not None:
            partial_count += 1
        else:
            stale_count += 1

    needs_attention = partial_count + stale_count
    running_job = db.query(SyncJob).filter(SyncJob.status == "RUNNING").first()

    data_freshness = "FRESH" if (latest_sync and (now - latest_sync).total_seconds() <= freshness_seconds) else "STALE"

    return {
        "total_students": total_count,
        "verified_count": verified_count,
        "partial_count": partial_count,
        "stale_count": stale_count,
        "needs_attention_count": needs_attention,
        "data_freshness_status": data_freshness,
        "freshness_hours_threshold": settings.SYNC_FRESHNESS_HOURS,
        "last_successful_sync": latest_sync.isoformat() if latest_sync else None,
        "is_sync_running": running_job is not None,
        "running_job_id": running_job.job_id if running_job else None,
        "freshness_badge": f"🟢 {verified_count}/{total_count} Verified | ⚠️ {needs_attention} Need Attention"
    }
