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


def dispatch_background_task(coro):
    """Dispatches async coroutine task reliably from sync or async threadpool contexts."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        try:
            # Fallback to main thread loop if running
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(coro)
            else:
                asyncio.run(coro)
        except Exception as e:
            logger.error(f"[SYNC] Failed to dispatch background coroutine: {e}")


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

    # 3. Launch background worker task reliably
    dispatch_background_task(_run_full_sync_worker(job_id))

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
    Guarantees every student completes (success or fail) within 25s timeout and updates DB progress live.
    """
    logger.info(f"[SYNC] Starting background live sync worker for job_id: {job_id}")
    db = SessionLocal()

    try:
        students = get_active_students(db)
        total_students = len(students)
        success_count = 0
        partial_count = 0
        error_count = 0

        sync_tracker.start(job_id, total_students)
        logger.info(f"[SYNC] Job started: {job_id} | Total students: {total_students}")

        semaphore = asyncio.Semaphore(12)

        async def _process_student_task(student: Student, idx: int):
            nonlocal success_count, partial_count, error_count
            async with semaphore:
                logger.info(f"[SYNC] Starting student {idx}/{total_students}: {student.reg_no} ({student.name})")
                res = None
                try:
                    res = await asyncio.wait_for(
                        fetch_leetcode_profile(student.leetcode_url or student.username),
                        timeout=25.0
                    )
                except Exception as exc:
                    logger.warning(f"[SYNC] Fetch timeout/exception for {student.reg_no} ({student.name}): {exc}")
                    res = exc

                # Dedicated DB session per student task to prevent lock collisions
                student_db = SessionLocal()
                is_succ, is_part, is_err = False, False, True
                try:
                    st_obj = student_db.query(Student).filter(Student.id == student.id).first()
                    if st_obj:
                        is_succ, is_part, is_err = _process_single_student_sync(student_db, job_id, st_obj, res)
                except Exception as db_exc:
                    logger.error(f"[SYNC] DB processing error for {student.reg_no}: {db_exc}")
                    is_succ, is_part, is_err = False, False, True
                finally:
                    student_db.close()

                # MANDATORY COUNTER UPDATE IN FINALLY
                if is_succ:
                    success_count += 1
                    sync_tracker.update(success_inc=1, log_msg=f"✅ {student.name} ({student.reg_no}) - Fresh live data synced.")
                    logger.info(f"[SYNC] Fetch success: {student.reg_no} | Progress: {sync_tracker.completed}/{total_students}")
                elif is_part:
                    partial_count += 1
                    sync_tracker.update(partial_inc=1, log_msg=f"⚠️ {student.name} ({student.reg_no}) - Preserved previous valid data.")
                    logger.info(f"[SYNC] Fetch partial: {student.reg_no} | Progress: {sync_tracker.completed}/{total_students}")
                else:
                    error_count += 1
                    sync_tracker.update(failed_inc=1, log_msg=f"❌ {student.name} ({student.reg_no}) - Sync failed.")
                    logger.info(f"[SYNC] Fetch failed: {student.reg_no} | Progress: {sync_tracker.completed}/{total_students}")

                # Persist progress to SyncJob table in DB & Firebase Realtime Database
                try:
                    job_rec = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
                    if job_rec:
                        job_rec.success_count = success_count
                        job_rec.partial_count = partial_count
                        job_rec.error_count = error_count
                        db.commit()

                    # Write persistent progress node to Firebase RTDB
                    from backend.services.firebase_rtdb_service import get_rtdb_reference
                    rtdb_jobs = get_rtdb_reference(f"sync_jobs/{job_id.replace('.', '_')}")
                    if rtdb_jobs:
                        rtdb_jobs.update({
                            "job_id": job_id,
                            "status": "RUNNING",
                            "total_students": total_students,
                            "processed": sync_tracker.completed,
                            "successful": success_count,
                            "failed": error_count,
                            "pending": max(0, total_students - sync_tracker.completed),
                            "last_updated_at": datetime.datetime.utcnow().isoformat() + "Z"
                        })
                except Exception as job_db_err:
                    logger.warning(f"[SYNC] SyncJob DB/RTDB progress update note: {job_db_err}")


                # Real-time WebSocket Broadcast
                await broadcast_sync_event({
                    "type": "SYNC_PROGRESS",
                    "job_id": job_id,
                    "total": total_students,
                    "completed": sync_tracker.completed,
                    "processed": sync_tracker.completed,
                    "success": success_count,
                    "partial": partial_count,
                    "failed": error_count,
                    "progress_percentage": round((sync_tracker.completed / max(1, total_students)) * 100.0, 1),
                    "recent_student": f"{student.name} ({student.reg_no})"
                })

        tasks = [_process_student_task(s, i) for i, s in enumerate(students, start=1)]
        await asyncio.gather(*tasks, return_exceptions=True)

        # 4. Dynamic Current Contest Matrix Refresh
        try:
            _sync_active_contest_data(db)
        except Exception as c_err:
            logger.warning(f"[SYNC] Contest matrix refresh note: {c_err}")

        # 5. Recalculate Multi-Level Ranks & Badges
        try:
            update_all_rankings_and_badges(db)
            db.commit()
        except Exception as r_err:
            logger.warning(f"[SYNC] Ranking update note: {r_err}")

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
                job_record.status = "PARTIAL"
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
        logger.info(f"[SYNC] COMPLETE: Job {job_id}. Total: {total_students}, Successful: {success_count}, Partial: {partial_count}, Failed: {error_count}, Processed: {sync_tracker.completed}")

    except Exception as exc:
        logger.error(f"[SYNC] Critical error during live sync worker {job_id}: {exc}")
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

        if res.get("recent_contest_name"):
            st.recent_contest_name = res.get("recent_contest_name")
        if res.get("recent_contest_score"):
            st.recent_contest_score = res.get("recent_contest_score")
        if res.get("public_profile_ranking") is not None:
            st.public_profile_ranking = res.get("public_profile_ranking")
        if contest_rating is not None:
            st.contest_rating = contest_rating
        if global_ranking is not None:
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
