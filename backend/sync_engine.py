import os
import time
import datetime
import asyncio
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.leetcode_fetcher import fetch_leetcode_profile, extract_leetcode_username
from backend.ranking import update_all_rankings_and_badges
from backend.logger import logger

class SyncProgressTracker:
    def __init__(self):
        self.is_running: bool = False
        self.total: int = 0
        self.completed: int = 0
        self.success: int = 0
        self.failed: int = 0
        self.pending: int = 0
        self.progress_percentage: float = 0.0
        self.start_time: Optional[str] = None
        self.end_time: Optional[str] = None
        self.recent_logs: List[str] = []
        self._lock = asyncio.Lock()
        self.run_id: Optional[str] = None  # Firestore syncRuns/{runId}
        self._fs_client = None             # Lazy Firestore client

    def reset(self, total_students: int, run_id: Optional[str] = None):
        self.is_running = True
        self.total = total_students
        self.completed = 0
        self.success = 0
        self.failed = 0
        self.pending = total_students
        self.progress_percentage = 0.0
        self.start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.end_time = None
        self.recent_logs = []
        self.run_id = run_id
        self._fs_client = None
        # Write initial syncRuns document
        self._write_firestore_progress(status="running")

    def record_completed(self, is_success: bool, log_msg: str):
        self.completed += 1
        if is_success:
            self.success += 1
        else:
            self.failed += 1
        self.pending = max(0, self.total - self.completed)
        self.progress_percentage = round((self.completed / max(1, self.total)) * 100.0, 1)
        
        # Keep last 50 logs in memory
        self.recent_logs.append(log_msg)
        if len(self.recent_logs) > 50:
            self.recent_logs.pop(0)

        # Write real-time progress to Firestore every 5 completions
        if self.completed % 5 == 0 or self.completed == self.total:
            self._write_firestore_progress(status="running")

    def _get_fs_client(self):
        """Lazily initialise Firestore Admin SDK (best-effort)."""
        if self._fs_client is not None:
            return self._fs_client
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore as fs_module
            import os
            if not firebase_admin._apps:
                sa_path = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "serviceAccountKey.json"
                )
                if os.path.exists(sa_path):
                    cred = credentials.Certificate(sa_path)
                    firebase_admin.initialize_app(cred)
                elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
                    firebase_admin.initialize_app(credentials.ApplicationDefault())
                else:
                    return None
            self._fs_client = fs_module.client()
        except Exception:
            self._fs_client = None
        return self._fs_client

    def _write_firestore_progress(self, status: str = "running"):
        """Write current progress to Firestore syncRuns/{runId} (best-effort, never throws)."""
        if not self.run_id:
            return
        try:
            client = self._get_fs_client()
            if not client:
                return
            client.collection("syncRuns").document(self.run_id).set({
                "runId":       self.run_id,
                "status":      status,
                "total":       self.total,
                "processed":   self.completed,
                "successful":  self.success,
                "failed":      self.failed,
                "pending":     self.pending,
                "startedAt":   self.start_time,
                "completedAt": self.end_time,
                "updatedAt":   datetime.datetime.now().isoformat()
            })
        except Exception:
            pass  # Never let Firestore failures block the sync

    def finish(self):
        self.is_running = False
        self.end_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._write_firestore_progress(status="completed")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "total": self.total,
            "completed": self.completed,
            "success": self.success,
            "failed": self.failed,
            "pending": self.pending,
            "progress_percentage": self.progress_percentage,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "recent_logs": self.recent_logs[-10:] if self.recent_logs else []
        }

sync_tracker = SyncProgressTracker()

def sync_single_student_db(student_id: int, stats_dict: Dict[str, Any], db: Session) -> Student:
    """
    Updates student LeetCode statistics in database with strict identity verification
    and Old Data Fallback rule.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError(f"Student with ID {student_id} not found.")

    if not student.stats:
        student.stats = LeetCodeProfileStats(student_id=student.id)
        db.add(student.stats)

    # 1. Identity Mapping Verification
    fetched_username = stats_dict.get("username")
    expected_username = student.username
    if expected_username and fetched_username and expected_username.lower() != fetched_username.lower():
        err_msg = f"CRITICAL IDENTITY MISMATCH: Fetched username '{fetched_username}' does not match expected student username '{expected_username}' for Reg {student.reg_no}"
        logger.error(err_msg)
        student.stats.sync_status = "mismatch"
        student.stats.status = "MISMATCH"
        student.stats.error_message = err_msg
        db.commit()
        db.refresh(student)
        return student

    status = stats_dict.get("status")
    is_success = status in ["success", "OK"]

    # 2. Sum Validation Check — use 0 as arithmetic sentinel only; actual DB write uses None for failed
    tot = stats_dict.get("total_solved")   # May be None for failed/missing fetches
    ez  = stats_dict.get("easy_solved")
    med = stats_dict.get("medium_solved")
    hd  = stats_dict.get("hard_solved")

    # Only validate the sum when all values are present integers and fetch succeeded
    if is_success and all(v is not None for v in [tot, ez, med, hd]):
        tot_int, ez_int, med_int, hd_int = int(tot), int(ez), int(med), int(hd)
        if (ez_int + med_int + hd_int != tot_int) and tot_int > 0:
            err_msg = f"CRITICAL STATS MISMATCH for {student.reg_no}: {ez_int} + {med_int} + {hd_int} != {tot_int}"
            logger.error(err_msg)
            student.stats.sync_status = "mismatch"
            student.stats.status = "MISMATCH"
            student.stats.error_message = err_msg
            db.commit()
            db.refresh(student)
            return student


    if is_success:
        student.stats.total_solved = tot
        student.stats.easy_solved = ez
        student.stats.medium_solved = med
        student.stats.hard_solved = hd
        student.stats.contest_rating = stats_dict.get("contest_rating")
        student.stats.contest_global_ranking = stats_dict.get("contest_global_rank") or stats_dict.get("contest_global_ranking")
        student.stats.public_profile_ranking = stats_dict.get("leetcode_global_rank") or stats_dict.get("public_profile_ranking")
        student.stats.recent_contest_name = stats_dict.get("recent_contest_name")
        student.stats.recent_contest_score = stats_dict.get("recent_contest_score")
        
        student.stats.status = "OK"
        student.stats.sync_status = "success"
        student.stats.source = "leetcode_public_profile"
        student.stats.error_message = None
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        student.stats.last_successful_sync = now_utc
        student.stats.last_verified_at = now_utc
        student.stats.fetch_duration = stats_dict.get("fetch_duration")
    else:
        # OLD DATA FALLBACK: DO NOT erase previous total_solved / contest ratings!
        # Preserve old stats, only update sync_status & error_message.
        student.stats.status = status or "failed"
        student.stats.sync_status = "failed"
        student.stats.error_message = stats_dict.get("error") or stats_dict.get("error_message") or "Sync failed"
        student.stats.fetch_duration = stats_dict.get("fetch_duration")

    student.stats.last_updated = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(student)
    return student

async def sync_single_student_by_id(student_id: int, timeout: float = 30.0) -> Dict[str, Any]:
    """
    Fetches LeetCode stats for a single student by ID with 30-second timeout constraint.
    If timeout occurs, preserves last known good data and returns timeout status.
    """
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {"status": "failed", "error": f"Student ID {student_id} not found."}

        url_or_username = student.leetcode_url or student.username
        logger.info(f"[INFO] Syncing single student (Timeout <= 30s): {student.reg_no} ({student.name}) - {url_or_username}")

        try:
            stats_dict = await asyncio.wait_for(
                fetch_leetcode_profile(url_or_username, force_refresh=True, timeout=12.0),
                timeout=timeout
            )
            updated_student = sync_single_student_db(student.id, stats_dict, db)

            try:
                update_all_rankings_and_badges(db)
                from backend.assets.sync_firestore import sync_database_to_firestore
                sync_database_to_firestore()
            except Exception as r_err:
                logger.warning(f"Rankings update / Firestore sync note: {r_err}")

            # Broadcast live update over websocket if available
            try:
                from backend.websocket_manager import manager
                # Never send false-zero — only send stats if actually verified
                stats_obj = updated_student.stats
                is_verified = stats_obj and stats_obj.sync_status in ("success", "OK")
                await manager.broadcast({
                    "type": "STUDENT_UPDATED",
                    "student_id": updated_student.id,
                    "name": updated_student.name,
                    "sync_status": stats_obj.sync_status if stats_obj else "pending",
                    "total_solved": (stats_obj.total_solved if is_verified else None)
                })
            except Exception:
                pass

            last_ver = updated_student.stats.last_verified_at if updated_student.stats else None
            return {
                "status": "success" if updated_student.stats and updated_student.stats.sync_status == "success" else "failed",
                "student_id": updated_student.id,
                "reg_no": updated_student.reg_no,
                "name": updated_student.name,
                "username": updated_student.username,
                "last_verified_at": last_ver.isoformat() if last_ver else None,
                "stats": stats_dict
            }
        except asyncio.TimeoutError:
            err_msg = f"Refresh timed out for {student.name} (> 30s limit). Showing last verified data."
            logger.warning(err_msg)
            st = student.stats
            last_ver = st.last_verified_at if (st and st.last_verified_at) else None
            # Preserve previously verified stats — never invent zeros
            is_prev_verified = st and st.sync_status in ("success", "OK") and st.last_verified_at is not None
            return {
                "status": "timeout",
                "message": f"Refresh timed out. Last verified data: {last_ver.isoformat() if last_ver else 'Never'}",
                "student_id": student.id,
                "name": student.name,
                "last_verified_at": last_ver.isoformat() if last_ver else None,
                "stats": {
                    "total_solved":   (st.total_solved   if is_prev_verified else None),
                    "easy_solved":    (st.easy_solved    if is_prev_verified else None),
                    "medium_solved":  (st.medium_solved  if is_prev_verified else None),
                    "hard_solved":    (st.hard_solved    if is_prev_verified else None),
                    "contest_rating": (st.contest_rating if is_prev_verified else None),
                    "status": "TIMEOUT",
                    "sync_status": "timeout"
                }
            }
    finally:
        db.close()

async def run_batch_sync(limit: Optional[int] = None, max_workers: int = 3, per_worker_delay: float = 0.3, pre_run_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes controlled queue sync for active students.
    Respects SYNC_LIMIT env variable or explicit `limit` argument.
    pre_run_id: If provided, uses this as the Firestore syncRuns document ID (so the frontend
                can subscribe before the sync starts).
    """
    # Check SYNC_LIMIT env var if limit parameter is not explicitly passed
    env_limit = os.environ.get("SYNC_LIMIT")
    if limit is None and env_limit:
        try:
            limit = int(env_limit)
        except ValueError:
            pass

    db = SessionLocal()
    try:
        query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
        students = query.order_by(Student.id.asc()).all()

        if limit and limit > 0:
            students = students[:limit]

        total_count = len(students)
        # Use pre_run_id if provided (so Firestore document matches what frontend subscribed to)
        run_id = pre_run_id or f"sync_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        sync_tracker.reset(total_count, run_id=run_id)

        logger.info(f"[INFO] Starting batch LeetCode sync for {total_count} students (Concurrency: {max_workers}, RunID: {run_id})...")
        sync_tracker.recent_logs.append(f"[INFO] Starting sync for {total_count} students, RunID: {run_id}...")

        queue = asyncio.Queue()
        for st in students:
            queue.put_nowait(st.id)

        async def worker(worker_id: int):
            while not queue.empty():
                try:
                    student_id = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                # Fetch fresh DB session for worker execution
                w_db = SessionLocal()
                try:
                    st = w_db.query(Student).filter(Student.id == student_id).first()
                    if not st:
                        queue.task_done()
                        continue

                    url_or_username = st.leetcode_url or st.username
                    num = sync_tracker.completed + 1
                    logger.info(f"[INFO] Fetching: {num}/{total_count} - Reg: {st.reg_no} | Username: {st.username or url_or_username}")

                    stats = await fetch_leetcode_profile(url_or_username, force_refresh=True)
                    is_ok = stats.get("status") in ["success", "OK"]

                    # Update student DB with Old Data Fallback rule
                    sync_single_student_db(st.id, stats, w_db)

                    if is_ok:
                        log_msg = f"[INFO] Success - {st.username or st.reg_no} (Solved: {stats.get('total_solved')}, Rating: {stats.get('contest_rating')}, Time: {stats.get('fetch_duration')}s)"
                        logger.info(log_msg)
                    else:
                        err_detail = stats.get("error") or stats.get("error_message") or "Unknown error"
                        log_msg = f"[WARN] Failed - {st.username or st.reg_no} ({err_detail})"
                        logger.warning(log_msg)

                    sync_tracker.record_completed(is_ok, log_msg)

                except Exception as ex:
                    log_msg = f"[ERROR] Worker error for student {student_id}: {ex}"
                    logger.error(log_msg)
                    sync_tracker.record_completed(False, log_msg)
                finally:
                    w_db.close()
                    queue.task_done()
                    await asyncio.sleep(per_worker_delay)

        workers = [asyncio.create_task(worker(i)) for i in range(max_workers)]
        await asyncio.gather(*workers)

        # Recalculate college & department rankings after batch complete
        logger.info("[INFO] Recalculating rankings and badges...")
        update_all_rankings_and_badges(db)

        # Sync 100% updated data directly to Cloud Firestore & trigger WebSocket update
        try:
            from backend.assets.sync_firestore import sync_database_to_firestore
            sync_database_to_firestore()
        except Exception as _fs_err:
            logger.warning(f"Firestore sync note: {_fs_err}")

        try:
            from backend.websocket_manager import manager
            asyncio.create_task(manager.broadcast({"type": "LEADERBOARD_UPDATED", "timestamp": time.time()}))
        except Exception as _ws_err:
            logger.warning(f"WebSocket broadcast note: {_ws_err}")

        sync_tracker.finish()
        summary_log = f"[INFO] Sync completed! Total: {sync_tracker.total}, Success: {sync_tracker.success}, Failed: {sync_tracker.failed}"
        logger.info(summary_log)
        sync_tracker.recent_logs.append(summary_log)

        result = sync_tracker.to_dict()
        result["runId"] = run_id
        return result

    finally:
        db.close()
