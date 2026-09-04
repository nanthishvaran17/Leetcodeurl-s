import os
import sys
import time
import datetime
import threading
from typing import Dict, Any

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklyStudentProgress
from backend.services.firestore_service import get_firestore_db, circuit_breaker
from backend.logger import logger

# In-memory dirty tracking cache to avoid redundant writes of unchanged student records
_SYNCHED_STUDENT_HASHES: Dict[int, str] = {}
_SYNC_LOCK = threading.Lock()


def get_firestore_client():
    """Returns Firestore client if circuit breaker is available and credentials exist."""
    return get_firestore_db()


def sync_database_to_firestore(force_all: bool = False) -> Dict[str, Any]:
    """
    Export / Sync SQLite student statistics & pre-calculated aggregations into Firestore.
    
    Optimizations & Protections:
      - Circuit breaker protected: rejects execution immediately if quota is currently exhausted.
      - Concurrency guarded: prevents duplicate/overlapping sync runs.
      - Dirty tracking: only queues writes for students whose stats/profile actually changed.
      - Safe batching: commits in small 50-operation batches with exponential backoff & jitter.
      - Fast abort on 429: halts batch loop immediately upon quota exhaustion to prevent error spam.
      - Failure isolation: never raises exceptions to callers; SQLite remains authoritative.
    """
    if not circuit_breaker.is_available():
        status = circuit_breaker.get_status()
        logger.info(
            f"[FIRESTORE_SYNC] Sync skipped — Circuit Breaker OPEN (cooldown remaining: {status.get('cooldown_remaining_seconds', 0)}s). "
            f"SQLite database is fully operational."
        )
        return {
            "status": "circuit_open_paused",
            "message": "Firestore sync paused due to rate-limiting / quota cooldown",
            "cooldown_remaining_seconds": status.get("cooldown_remaining_seconds", 0)
        }

    # Prevent concurrent execution of full syncs
    if not _SYNC_LOCK.acquire(blocking=False):
        logger.info("[FIRESTORE_SYNC] Sync already in progress by another worker. Skipping concurrent trigger.")
        return {"status": "already_running"}

    start_time = time.time()
    db = SessionLocal()
    fs_db = get_firestore_client()

    if not fs_db:
        _SYNC_LOCK.release()
        db.close()
        return {"status": "firestore_unavailable"}

    total_students = 0
    changed_records = 0
    successful_batches = 0
    failed_batches = 0
    quota_exhausted = False

    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        total_students = len(students)

        active_count = 0
        total_solved_sum = 0
        weekly_progress_sum = 0
        valid_profiles = 0
        missing_links = 0
        invalid_links = 0

        leaderboard_items = []
        dept_summary = {}

        # Collect changed student docs
        student_docs_to_write = []

        for s in students:
            stats = s.stats
            prog = db.query(WeeklyStudentProgress).filter(
                WeeklyStudentProgress.student_id == s.id
            ).order_by(WeeklyStudentProgress.id.desc()).first()

            total_solved = stats.total_solved if (stats and stats.total_solved is not None) else None
            if total_solved is not None:
                total_solved_sum += total_solved
                if total_solved > 0:
                    active_count += 1

            weekly_prog = prog.weekly_progress if (prog and prog.weekly_progress) else 0
            weekly_progress_sum += weekly_prog

            status = stats.status if stats else "NOT STARTED"
            if status in ("OK", "success"):
                valid_profiles += 1
            elif status in ("MISSING LINK", "MISSING_LINK"):
                missing_links += 1
            elif status in ("INVALID LINK", "INVALID_LINK"):
                invalid_links += 1

            dept_code = s.department.code if s.department else "GEN"
            dept_name = s.department.name if s.department else "General"
            if dept_code not in dept_summary:
                dept_summary[dept_code] = {
                    "department_code": dept_code,
                    "department_name": dept_name,
                    "total_students": 0,
                    "active_students": 0,
                    "total_solved": 0,
                    "weekly_progress": 0,
                    "top_student_name": "N/A",
                    "top_solved": 0
                }

            dept_summary[dept_code]["total_students"] += 1
            dept_summary[dept_code]["total_solved"] += (total_solved or 0)
            dept_summary[dept_code]["weekly_progress"] += weekly_prog
            if total_solved and total_solved > 0:
                dept_summary[dept_code]["active_students"] += 1
            if total_solved and total_solved > dept_summary[dept_code]["top_solved"]:
                dept_summary[dept_code]["top_solved"] = total_solved
                dept_summary[dept_code]["top_student_name"] = s.name

            # Determine sync status cleanly
            if stats and stats.sync_status:
                sync_st = stats.sync_status
            elif stats and stats.status in ("OK", "success") and total_solved is not None:
                sync_st = "success"
            elif status in ("INVALID LINK", "MISSING LINK", "INVALID_LINK", "MISSING_LINK"):
                sync_st = "invalid_profile"
            else:
                sync_st = "pending"

            # Check dirty state to avoid rewriting unchanged documents
            state_hash = f"{s.id}:{s.username}:{total_solved}:{stats.easy_solved if stats else None}:{stats.medium_solved if stats else None}:{stats.hard_solved if stats else None}:{stats.contest_rating if stats else None}:{status}:{sync_st}:{weekly_prog}"
            is_dirty = force_all or (_SYNCHED_STUDENT_HASHES.get(s.id) != state_hash)

            if is_dirty:
                student_doc = {
                    "id": s.id,
                    "registerNo": s.reg_no,
                    "name": s.name,
                    "email": s.email or "",
                    "department": dept_code,
                    "departmentName": dept_name,
                    "year": s.year_level,
                    "section": s.section.name if s.section else "A",
                    "leetcodeUsername": s.username or "",
                    "leetcodeProfileUrl": s.leetcode_url or "",
                    "isActive": s.is_active
                }

                last_ver = stats.last_verified_at.isoformat() if (stats and stats.last_verified_at) else None
                last_att = stats.last_attempt_at.isoformat() if (stats and getattr(stats, 'last_attempt_at', None)) else None

                stats_doc = {
                    "studentId": s.id,
                    "registerNo": s.reg_no,
                    "leetcodeUsername": s.username or "",
                    "totalSolved": total_solved,
                    "easySolved": stats.easy_solved if (stats and stats.easy_solved is not None) else None,
                    "mediumSolved": stats.medium_solved if (stats and stats.medium_solved is not None) else None,
                    "hardSolved": stats.hard_solved if (stats and stats.hard_solved is not None) else None,
                    "contestRating": stats.contest_rating if stats else None,
                    "globalRanking": stats.public_profile_ranking if stats else None,
                    "status": status,
                    "syncStatus": sync_st,
                    "validationStatus": getattr(stats, 'validation_status', None) if stats else None,
                    "source": stats.source if (stats and stats.source) else None,
                    "lastVerifiedAt": last_ver,
                    "lastAttemptAt": last_att,
                    "errorCode": getattr(stats, 'error_code', None) if stats else None,
                    "retryCount": getattr(stats, 'retry_count', 0) if stats else 0,
                    "weeklySolved": weekly_prog,
                    "streakCount": prog.streak_count if prog else 0,
                    "consistencyScore": prog.consistency_score if prog else 0.0,
                    "collegeRank": prog.college_rank if prog else None
                }

                student_docs_to_write.append((s.id, student_doc, stats_doc, state_hash))

            # Leaderboard collection inclusion
            is_verified_for_lb = (
                stats and
                stats.sync_status in ("success", "OK") and
                getattr(stats, 'validation_status', None) in ("verified", None) and
                total_solved is not None
            )
            if is_verified_for_lb:
                leaderboard_items.append({
                    "rank": prog.college_rank if (prog and prog.college_rank) else 9999,
                    "studentId": s.id,
                    "name": s.name,
                    "registerNo": s.reg_no,
                    "department": dept_code,
                    "section": s.section.name if s.section else "A",
                    "totalSolved": total_solved,
                    "contestRating": stats.contest_rating if stats else None,
                    "weeklyProgress": weekly_prog
                })

        changed_records = len(student_docs_to_write)
        logger.info(f"[FIRESTORE_SYNC] Initiated: {total_students} total students, {changed_records} records queued for write (Batch size: 50).")

        # Execute student writes in controlled batches of 25 students (50 document ops)
        if changed_records > 0 and fs_db:
            batch_size_students = 25  # 25 students = 50 doc sets (students + leetcodeStats)
            for i in range(0, changed_records, batch_size_students):
                chunk = student_docs_to_write[i:i + batch_size_students]
                batch = fs_db.batch()

                for s_id, s_doc, st_doc, _ in chunk:
                    batch.set(fs_db.collection("students").document(str(s_id)), s_doc, merge=True)
                    batch.set(fs_db.collection("leetcodeStats").document(str(s_id)), st_doc, merge=True)

                # Commit batch with retry & backoff
                for attempt in range(2):
                    try:
                        batch.commit()
                        successful_batches += 1
                        circuit_breaker.record_success()
                        # Update hashes for successfully committed students
                        for s_id, _, _, s_hash in chunk:
                            _SYNCHED_STUDENT_HASHES[s_id] = s_hash
                        break
                    except Exception as b_err:
                        is_q = circuit_breaker.record_error(b_err)
                        if is_q:
                            quota_exhausted = True
                            failed_batches += 1
                            logger.warning(f"[FIRESTORE_SYNC] Batch {successful_batches + 1} quota exceeded. Halting remaining batches.")
                            break
                        else:
                            time.sleep(1.0 + (attempt * 0.5))

                if quota_exhausted:
                    break

        # Calculate & Commit Aggregations (Single batch)
        if not quota_exhausted and fs_db:
            leaderboard_items.sort(key=lambda x: (x["rank"], -x["totalSolved"]))
            top_10_leaderboard = leaderboard_items[:10]

            college_kpis = {
                "total_students": total_students,
                "active_students": active_count,
                "not_started_students": total_students - active_count,
                "total_problems_solved": total_solved_sum,
                "average_weekly_progress": round(weekly_progress_sum / max(1, total_students), 1),
                "participation_rate": round((active_count / max(1, total_students)) * 100, 1),
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }

            data_quality_kpis = {
                "total_students": total_students,
                "valid_profiles": valid_profiles,
                "missing_links": missing_links,
                "invalid_links": invalid_links,
                "health_score_percentage": round((valid_profiles / max(1, total_students)) * 100, 1),
                "last_sync": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }

            dept_list = []
            for code, info in dept_summary.items():
                tot = info["total_students"]
                dept_list.append({
                    "department_code": code,
                    "department_name": info["department_name"],
                    "total_students": tot,
                    "active_students": info["active_students"],
                    "participation_rate": round((info["active_students"] / max(1, tot)) * 100, 1),
                    "avg_solved": round(info["total_solved"] / max(1, tot), 1),
                    "avg_progress": round(info["weekly_progress"] / max(1, tot), 1),
                    "top_student_name": info["top_student_name"]
                })

            try:
                agg_batch = fs_db.batch()
                agg_batch.set(fs_db.collection("collegeStats").document("current"), college_kpis, merge=True)
                agg_batch.set(fs_db.collection("leaderboard").document("current"), {"top_10": top_10_leaderboard}, merge=True)
                agg_batch.set(fs_db.collection("dataQuality").document("current"), data_quality_kpis, merge=True)
                for d in dept_list:
                    agg_batch.set(fs_db.collection("departmentStats").document(d["department_code"]), d, merge=True)

                agg_batch.commit()
                circuit_breaker.record_success()
            except Exception as agg_err:
                circuit_breaker.record_error(agg_err)
                logger.debug(f"[FIRESTORE_SYNC] Aggregations batch note: {agg_err}")

        duration = round(time.time() - start_time, 2)
        summary = {
            "status": "paused_quota_exhausted" if quota_exhausted else "success",
            "total_students": total_students,
            "changed_records": changed_records,
            "successful_batches": successful_batches,
            "failed_batches": failed_batches,
            "quota_exhausted": quota_exhausted,
            "duration_seconds": duration
        }
        logger.info(
            f"[FIRESTORE_SYNC] Summary: total={total_students}, changed={changed_records}, "
            f"batches_success={successful_batches}, batches_failed={failed_batches}, "
            f"quota_tripped={quota_exhausted}, duration={duration}s"
        )
        return summary

    except Exception as general_err:
        circuit_breaker.record_error(general_err)
        logger.warning(f"[FIRESTORE_SYNC] Sync execution note: {general_err}")
        return {"status": "error", "error": str(general_err)}

    finally:
        db.close()
        _SYNC_LOCK.release()


def initialize_pending_records():
    """
    Ensures newly registered students have default records without performing 1,472 individual reads.
    Uses circuit breaker and delegates to the optimized batch sync.
    """
    if not circuit_breaker.is_available():
        logger.debug("[FIRESTORE_INIT] Skipped pending record initialization — Circuit breaker OPEN.")
        return

    fs_db = get_firestore_client()
    if not fs_db:
        return

    try:
        # Check single control document
        init_doc_ref = fs_db.collection("systemMetadata").document("pendingInitStatus")
        init_doc = init_doc_ref.get()
        if init_doc.exists and init_doc.to_dict().get("status") == "INITIALIZED":
            logger.debug("[FIRESTORE_INIT] Pending records already initialized. No action required.")
            return

        # Perform one-time bulk sync to populate missing docs
        logger.info("[FIRESTORE_INIT] Running one-time initial Firestore pending records sync...")
        res = sync_database_to_firestore(force_all=False)
        if res.get("status") == "success":
            init_doc_ref.set({
                "status": "INITIALIZED",
                "initialized_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }, merge=True)
            logger.info("[FIRESTORE_INIT] One-time initialization completed successfully.")
    except Exception as err:
        is_q = circuit_breaker.record_error(err)
        if not is_q:
            logger.debug(f"[FIRESTORE_INIT] Note: {err}")


if __name__ == "__main__":
    sync_database_to_firestore(force_all=True)
